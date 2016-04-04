define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dojo/dom-style",
    "dojo/dom-construct",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/text!Leaflet/widget/template/Leaflet.html",
    // Leaflet
    "Leaflet/lib/leaflet-src",

    // Plugins
    "Leaflet/lib/leaflet-providers",
    "Leaflet/lib/leaflet-locatecontrol",
    "Leaflet/lib/leaflet-fullscreen"

], function (declare, _WidgetBase, _TemplatedMixin, domStyle, domConstruct, dojoArray, lang, widgetTemplate, Leaflet) {
    "use strict";

    var LL = Leaflet.noConflict();
    LL.Icon.Default.imagePath = require.toUrl("Leaflet/widget/ui/").split("?")[0];

    return declare("Leaflet.widget.Leaflet", [_WidgetBase, _TemplatedMixin], {

        // Template
        templateString: widgetTemplate,

        // DOM node
        mapContainer: null,

        // Set by modeler
        gotocontext: false,
        defaultLat: 0,
        defaultLng: 0,
        minZoom: 0,
        maxZoom: 20,
        lowestZoom: 10,
        updateRefresh: false,

        mapEntity: "",
        xpathConstraint: "",
        markerDisplayAttr: "",
        latAttr: "",
        lngAttr: "",
        onClickMarkerMf: "",

        mapHeight: "",
        mapWidth: "",
        markerTemplate: "<p>{Marker}</p>",

        mapType: "OpenStreetMap_Mapnik",
        customMapType: false,
        customMapTypeUrl: "//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        customMapTypOptions: "{subdomains:'abc'}",

        controlDragging: true,
        controlTouchZoom: true,
        controlScrollWheelZoom: true,
        controlZoomControl: true,
        controlZoomControlPosition: "topleft",
        controlAttribution: true,
        controlAttributionPosition: "bottomright",
        controlFullscreen: false,
        controlFullscreenPosition: "topright",

        locateControl: false,
        locateControlPosition: "topleft",
        locateControlDrawCircle: true,
        locateControlKeepZoomLevel: false,

        scaleControl: false,
        scaleControlPosition: "bottomleft",
        scaleControlMetric: true,
        scaleControlImperial: true,
        scaleControlMaxWidth: 100,

        // Internal variables
        _markerCache: [],
        _layerGroup: null,
        _minZoom: 0,
        _maxZoom: 20,

        _defaultPosition: [],
        _handle: null,
        _contextObj: null,
        _map: null,

        postCreate: function () {
            logger.debug(this.id + ".postCreate");

            this._defaultPosition = [
                parseFloat(this.defaultLat),
                parseFloat(this.defaultLng)
            ];

            this._minZoom = this.minZoom >= 0 ? this.minZoom : 0;
            this._maxZoom = this.maxZoom > this.minZoom ? this.maxZoom : this.minZoom;

            this._layerGroup = new LL.layerGroup();
        },

        update: function (obj, callback) {
            logger.debug(this.id + ".update");
            this._contextObj = obj;
            this._resetSubscriptions();

            if (!this._map) {
                this._loadMap(callback);
            } else {
                this._fetchMarkers(callback);
            }
        },

        resize: function (box) {
            logger.debug(this.id + ".resize");
            if (this._map) {
                this._map.invalidateSize();
            }
        },

        _resetSubscriptions: function () {
            logger.debug(this.id + "._resetSubscriptions");

            if (this._handle) {
                logger.debug(this.id + "._resetSubscriptions unsubscribe", this._handle);
                this.unsubscribe(this._handle);
                this._handle = null;
            }

            if (this._contextObj) {
                logger.debug(this.id + "._resetSubscriptions subscribe", this._contextObj.getGuid());
                this._handle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: lang.hitch(this, function (guid) {
                        this._fetchMarkers();
                    })
                });
            } else {
                this._handle = this.subscribe({
                    entity: this.mapEntity,
                    callback: lang.hitch(this, function (entity) {
                        this._fetchMarkers();
                    })
                });
            }
        },

        _getMapLayer: function () {
            var tileLayer = null;

            if (this.customMapType && this.customMapTypeUrl) {
                var options = null;

                try {
                    options = JSON.parse(this.customMapTypeOptions);
                } catch (e) {
                    console.error(this.id + "._getMapLayer error parsing Custom Map Options: " + e.toString());
                    options = {};
                }

                tileLayer = LL.tileLayer(this.customMapTypeUrl, options);

            } else {
                var providerName = this.mapType.replace(/_/g, ".");
                tileLayer = LL.tileLayer.provider(providerName);
            }

            if (tileLayer.options.minZoom < this._minZoom) {
                tileLayer.options.minZoom = this._minZoom;
            }

            if (tileLayer.options.maxZoom > this._maxZoom) {
                tileLayer.options.maxZoom = this._maxZoom;
            }

            return tileLayer;
        },

        _loadMap: function (callback) {
            logger.debug(this.id + "._loadMap");

            domStyle.set(this.domNode, { height: this.mapHeight });
            domStyle.set(this.mapContainer, {
                height: this.mapHeight,
                width: this.mapWidth
            });

            this._map = LL.map(this.mapContainer, {
                dragging: this.controlDragging,
                touchZoom: this.controlTouchZoom,
                scrollWheelZoom: this.controlScrollWheelZoom,
                zoomControl: this.controlZoomControl,
                attributionControl: this.controlAttribution
            }).setView(this._defaultPosition, this.lowestZoom);

            if (this.controlZoomControl) {
                this._map.zoomControl.setPosition(this.controlZoomControlPosition);
            }

            if (this.controlAttribution) {
                this._map.attributionControl.setPosition(this.controlAttributionPosition);
            }

            if (this.controlFullscreen) {
                LL.control.fullscreen({
                    position: "topright",
                    forceSeparateButton: true
                }).addTo(this._map);
            }

            if (this.scaleControl) {
                LL.control.scale({
                    position: this.scaleControlPosition,
                    maxWidth: this.scaleControlMaxWidth > 0 ? this.scaleControlMaxWidth : 100,
                    metric: this.scaleControlMetric,
                    imperial: this.scaleControlImperial
                }).addTo(this._map);
            }

            if (this.locateControl) {
                LL.control.locate({
                    position: this.locateControlPosition,
                    drawCircle: this.locateControlDrawCircle,
                    keepCurrentZoomLevel: this.locateControlKeepZoomLevel,
                    icon: "glyphicon glyphicon-screenshot",         // Using glyphicons that are part of Mendix
                    iconLoading: "glyphicon glyphicon-refresh"
                }).addTo(this._map);
            }

            this._map.addLayer(this._getMapLayer());
            this._map.setZoom(this.lowestZoom); // trigger setzoom to make sure it is rendered
            this._layerGroup.addTo(this._map);

            this._fetchMarkers(callback);
        },

        _fetchMarkers: function (callback) {
            logger.debug(this.id + "._fetchMarkers");
            if (this.gotocontext) {
                this._goToContext(callback);
            } else {
                if (this.updateRefresh) {
                    this._fetchFromDB(callback);
                } else {
                    if (this._markerCache) {
                        this._fetchFromCache(callback);
                    } else {
                        this._fetchFromDB(callback);
                    }
                }
            }
        },

        _refreshMap: function (objs, callback) {
            logger.debug(this.id + "._refreshMap");
            var panPosition = this._defaultPosition,
                positions = [];

            dojoArray.forEach(objs, lang.hitch(this, function (obj) {
                this._addMarker(obj);
                var position = this._getLatLng(obj);
                if (position) {
                    positions.push(position); // reversing lat lng for boundingExtent
                    panPosition = position;
                } else {
                    logger.error(this.id + ": " + "Incorrect coordinates (" + this.checkAttrForDecimal(obj, this.latAttr) + "," + this.checkAttrForDecimal(obj, this.lngAttr) + ")");
                }
            }));

            if (positions.length < 2) {
                this._map.setZoom(this.lowestZoom);
                this._map.panTo(panPosition);
            } else {
                this._map.fitBounds(positions);
            }

            mendix.lang.nullExec(callback);
        },

        _fetchFromDB: function (callback) {
            logger.debug(this.id + "._fetchFromDB");
            var xpath = "//" + this.mapEntity + this.xpathConstraint;

            this._removeAllMarkers();

            if (this._contextObj) {
                xpath = xpath.replace("[%CurrentObject%]", this._contextObj.getGuid());
                mx.data.get({
                    xpath: xpath,
                    callback: lang.hitch(this, function (objs) {
                        this._refreshMap(objs, callback);
                    })
                });
            } else if (!this._contextObj && (xpath.indexOf("[%CurrentObject%]") > -1)) {
                console.warn("No context for xpath, not fetching.");
                if (typeof callback === "function") {
                    callback();
                }
            } else {
                mx.data.get({
                    xpath: xpath,
                    callback: lang.hitch(this, function (objs) {
                        this._refreshMap(objs, callback);
                    })
                });
            }
        },

        _fetchFromCache: function (callback) {
            logger.debug(this.id + "._fetchFromCache");
            var cached = false,
                bounds = [];

            this._removeAllMarkers();

            dojoArray.forEach(this._markerCache, lang.hitch(this, function (markerObj, index) {
                if (this._contextObj) {
                    if (markerObj.id === this._contextObj.getGuid()) {
                        markerObj.marker.addTo(this._map);
                        bounds.push(markerObj.loc);
                        cached = true;
                    }
                } else {
                    markerObj.marker.addTo(this._map);
                }
                if (index === this._markerCache.length - 1) {
                    this._map.fitBounds(bounds);
                }
            }));

            if (!cached) {
                this._fetchFromDB(callback);
            } else if (typeof callback === "function") {
                callback();
            }
        },

        _removeAllMarkers: function () {
            logger.debug(this.id + "._removeAllMarkers");
            if (this._map) {
                this._layerGroup.clearLayers();
            }
        },

        _addMarker: function (obj) {
            logger.debug(this.id + "._addMarker");

            var id = this._contextObj ? this._contextObj.getGuid() : null,
                lat = parseFloat(this.checkAttrForDecimal(obj, this.latAttr)),
                lng = parseFloat(this.checkAttrForDecimal(obj, this.lngAttr)),
                loc = [lat, lng],
                markerObj = {
                    context: id,
                    obj: obj,
                    marker: null,
                    loc: loc
                };

            var marker = LL.marker(loc);

            if (this.onClickMarkerMf !== "") {
                marker.on("click", lang.hitch(this, function (e) {
                    this._executeMf(this.onClickMarkerMf, obj);
                }));
            }

            if (this.markerDisplayAttr) {
                var template = this.markerTemplate !== "" ?
                                this.markerTemplate.replace("{Marker}", obj.get(this.markerDisplayAttr)) :
                                "<p>" + obj.get(this.markerDisplayAttr) + "<p/>";

                marker.bindPopup(template, {
                    closeButton: false
                });
            }

            this._layerGroup.addLayer(marker);
            markerObj.marker = marker;

            if (!this._markerCache) {
                this._markerCache = [];
            }

            var found = false;
            dojoArray.forEach(this._markerCache, lang.hitch(this, function (markerObj) {
                if (markerObj.obj.getGuid() === obj.getGuid()) {
                    found = true;
                }
            }));

            if (!found) {
                this._markerCache.push(markerObj);
            }
        },

        checkAttrForDecimal: function (obj, attr) {
            logger.debug(this.id + ".checkAttrForDecimal");
            if (obj.get(attr) === "Decimal") {
                return obj.get(attr).toFixed(5);
            } else {
                return obj.get(attr);
            }
        },

        _getLatLng: function (obj) {
            logger.debug(this.id + "._getLatLng");
            var lat = this.checkAttrForDecimal(obj, this.latAttr),
                lng = this.checkAttrForDecimal(obj, this.lngAttr);

            if (lat === "" && lng === "") {
                return this._defaultPosition;
            } else if (!isNaN(lat) && !isNaN(lng) && lat !== "" && lng !== "") {
                return [
                    parseFloat(lat),
                    parseFloat(lng)
                ];
            } else {
                return null;
            }
        },

        _goToContext: function (callback) {
            logger.debug(this.id + "._goToContext");
            this._removeAllMarkers();
            if (this._map && this._contextObj) {
                var objs = [];
                if (this._contextObj) {
                    objs = [ this._contextObj ];
                } else {
                    logger.error(this.id + "._goToContext: no Context object while you have set \"Pan to context\" in the Modeler! Showing default position");
                }
                this._refreshMap(objs, callback);
            } else {
                mendix.lang.nullExec(callback);
            }
        },

        _executeMf: function(mf, obj) {
            logger.debug(this.id + "._executeMf");
			if (mf && obj && obj.getGuid()) {
				mx.data.action({
					store: {
						caller: this.mxform
					},
					params: {
                        guids: [ obj.getGuid() ],
                        applyto: "selection",
						actionname: mf
					},
					callback: lang.hitch(this, function() {
                        logger.debug(this.id + "._executeMf success");
                    }),
					error: lang.hitch(this, function(e) {
                        console.error(this.id + "._executeMf failed, error: ", e.toString());
                    })
				});
			}
		},

        uninitialize: function () {
            logger.debug(this.id + ".uninitialize");
            if (this._map) {
                this._map.remove();
                this._markerCache = [];
            }
        }
    });
});

require(["Leaflet/widget/Leaflet"], function() {});
