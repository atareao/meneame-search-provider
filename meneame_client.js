/*
 * This file is part of meneame-search-provider
 *
 * Copyright (c) 2018 Lorenzo Carbonell Cerezo <a.k.a. atareao>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

const Soup = imports.gi.Soup;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Extension.imports.convenience;

const PROTOCOL = 'https';
const BASE_URL = 'www.meneame.net';
const BASE_URL_IMAGES = 'mnmstatic.net';
const SEARCH = '/search?q=%s'
const USER_AGENT = 'GNOME Shell - MeneameSearchProvider - extension';
const HTTP_TIMEOUT = 10;

const DEFAULT = {
    0: "",
    1: "queue",
    2: "articles",
    3: "popular",
    4: "top_visited"
}
const WHERE = { // param "w"
    0: "links",
    1: "posts",
    2: "comments"
}
const FIELDS = { // param "p"
    0: "url",
    1: "tags",
    2: "title",
    3: "site",
    4: ""
}
const STATUS = { // param "s"
    0: "published",
    1: "queued",
    2: "discard",
    3: "autodiscard",
    4: "abuse",
    5: ""
}
const PERIODE = { // param "h"
    0: "24",
    1: "48",
    2: "168",
    3: "720",
    4: "4320",
    5: "8760",
    6: ""
}
const ORDER = { // param "o"
    0: "",
    1: "date"
}
function _build_result_url(relative){
    let url = '%s://%s/%s'.format(
        PROTOCOL,
        BASE_URL_IMAGES,
        relative
    );
    return url;
}

class MeneameClient{
    constructor(params){
        this._protocol = PROTOCOL;
        this._base_url = BASE_URL;

        this._settings = Convenience.getSettings();
        this._default = DEFAULT[this._settings.get_enum('default')];
        this._where = WHERE[this._settings.get_enum('where')];
        this._fields = FIELDS[this._settings.get_enum('fields')]
        this._status = STATUS[this._settings.get_enum('status')]
        this._periode = PERIODE[this._settings.get_enum('periode')]
        this._order = ORDER[this._settings.get_enum('order')]
        this._settings.connect("changed", ()=>{
            this._default = DEFAULT[this._settings.get_enum('default')];
            this._where = WHERE[this._settings.get_enum('where')];
            this._fields = FIELDS[this._settings.get_enum('fields')]
            this._status = STATUS[this._settings.get_enum('status')]
            this._periode = PERIODE[this._settings.get_enum('periode')]
            this._order = ORDER[this._settings.get_enum('order')]
            });
    }

    _build_query_url(word){
        word = word.substring(2).trim();
        let url = null;
        if(word.length == 0){
            url = '%s://%s/%s'.format(
                this._protocol,
                this._base_url,
                this._default
            );
        }else{
            if(this._where == 'links'){
                url = '%s://%s/search?q=%s&w=links&p=%s&s=%s&h=%s&o=%s'.format(
                    this._protocol,
                    this._base_url,
                    encodeURIComponent(word),
                    this._fields,
                    this._status,
                    this._periode,
                    this._order
                );
            }else{
                url = '%s://%s/search?q=%s&w=%s'.format(
                    this._protocol,
                    this._base_url,
                    encodeURIComponent(word),
                    this._where
                );
            }
        }
        return url;
    }

    get(word, callback, p1, p2) {
        let query_url = this._build_query_url(word);
        if(query_url != null){
            let request = Soup.Message.new('GET', query_url);
            _get_soup_session().queue_message(request,
                (http_session, message) => {
                    if(message.status_code !== Soup.KnownStatusCode.OK) {
                        let error_message =
                            "Meneame.Client:get(): Error code: %s".format(
                                message.status_code
                            );
                            callback(error_message, null);
                        return;
                    }else{
                        try {
                            let data = request.response_body.data;
                            let position = -1;
                            let results = [];
                            let i = 0;
                            do{
                                position ++;
                                position = data.indexOf('<div class="news-summary">', position);
                            
                                let position_image_start = data.indexOf('data-src', position) + 10;
                                let position_image_end = data.indexOf('"', position_image_start);
                                let position_image_end1 = data.indexOf('\'', position_image_start);
                                let position_image_end2 = data.indexOf('?', position_image_start);
                                if(position_image_end1 < position_image_end){
                                    position_image_end = position_image_end1;
                                }
                                if(position_image_end2 < position_image_end){
                                    position_image_end = position_image_end2;
                                }
                                let image_url = data.substring(position_image_start, position_image_end);
                                let position_title_start = data.indexOf('<h2>', position) + 4;
                                position_title_start = data.indexOf('>', position_title_start) + 1;
                                let position_title_end = data.indexOf('</a>', position_title_start);
                                let title = data.substring(position_title_start, position_title_end);
                                let position_content_start = data.indexOf('<div class="news-content">', position) + 26;
                                let position_content_end = data.indexOf('</div>', position_content_start);
                                let content = data.substring(position_content_start, position_content_end);
                                let position_url_start = data.indexOf('<h2>', position) + 14;
                                let position_url_end = data.indexOf('class', position_url_start) - 2;
                                let url = data.substring(position_url_start, position_url_end);
                                if(position > -1 && results.length < 10)
                                {
                                    results.push({
                                        id: 'index_'+i,
                                        label: title,
                                        url: url,
                                        description: content,
                                        thumbnail_url: _build_result_url(image_url),
                                        thumbnail_width: 155,
                                        thumbnail_height: 155
                                    });
                                    i += 1;
                                }
                            }while(position > -1)
                            if(results.length > 0){
                                callback(null, results, p1, p2);
                                return;
                            }
                        }
                        catch(e) {
                            let message = "Meneame.Client:get(): %s".format(e);
                            callback(message, null, p1, p2);
                            return;
                        }
                    }
                }
            );
        }
        let message = "Nothing found";
        callback(message, null, p1, p2);
    }
    destroy() {
        _get_soup_session().run_dispose();
        _SESSION = null;
    }

    get protocol() {
        return this._protocol;
    }

    set protocol(protocol) {
        this._protocol = protocol;
    }

    get base_url() {
        return this._base_url;
    }

    set base_url(url) {
        this._base_url = url;
    }
}

let _SESSION = null;

function _get_soup_session() {
    if(_SESSION === null) {
        _SESSION = new Soup.SessionAsync();
        Soup.Session.prototype.add_feature.call(
            _SESSION,
            new Soup.ProxyResolverDefault()
        );
        _SESSION.user_agent = USER_AGENT;
        _SESSION.timeout = HTTP_TIMEOUT;
    }

    return _SESSION;
}
