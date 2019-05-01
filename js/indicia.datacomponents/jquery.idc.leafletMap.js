/**
 * @file
 * A plugin for Leaflet maps.
 *
 * Indicia, the OPAL Online Recording Toolkit.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see http://www.gnu.org/licenses/gpl.html.
 *
 * @author Indicia Team
 * @license http://www.gnu.org/licenses/gpl.html GPL 3.0
 * @link https://github.com/indicia-team/client_helpers
 */

/* eslint no-underscore-dangle: ["error", { "allow": ["_source"] }] */

/**
 * Output plugin for maps.
 */
(function leafletMapPlugin() {
  'use strict';
  var $ = jQuery;

  /**
   * Place to store public methods.
   */
  var methods;

  /**
   * Declare default settings.
   */
  var defaults = {
    initialBoundsSet: false,
    initialLat: 54.093409,
    initialLng: -2.89479,
    initialZoom: 5,
    baseLayer: 'OpenStreetMap',
    cookies: true
  };

  /**
   * Registered callbacks for different events.
   */
  var callbacks = {
    moveend: []
  };

  /**
   * Variable to hold the marker used to highlight the currently selected row
   * in a linked idcDataGrid.
   */
  var selectedRowMarker = null;

   /**
   * Variable to hold the polygon used to highlight the currently selected
   * location boundary when relevant.
   */
  var selectedFeature = null;

  /**
   * Add a feature to the map (marker, circle etc).
   */
  function addFeature(el, sourceId, location, metric) {
    var config = { type: 'marker', options: {} };
    if (typeof $(el)[0].settings.styles[sourceId] !== 'undefined') {
      $.extend(config, $(el)[0].settings.styles[sourceId]);
    }
    if (config.type === 'circle' && typeof metric !== 'undefined') {
      config.options.radius = metric;
      config.options.fillOpacity = 0.5;
      config.options.stroke = false;
    }
    switch (config.type) {
      // Circle markers on layer.
      case 'circle':
        el.outputLayers[sourceId].addLayer(L.circle(location, config.options));
        break;
      // Leaflet.heat powered heat maps.
      case 'heat':
        el.outputLayers[sourceId].addLatLng([location.lat, location.lon, metric]);
        break;
      // Default layer type is markers.
      default:
        el.outputLayers[sourceId].addLayer(L.marker(location, config.options));
    }
  }

  /**
   * Thicken the borders of selected features when zoomed out to aid visibility.
   */
  function ensureFeatureClear(el, feature) {
    var weight = Math.min(20, Math.max(1, 20 - (el.map.getZoom())));
    var opacity = Math.min(1, Math.max(0.6, el.map.getZoom() / 18));
    if (typeof feature.setStyle !== 'undefined') {
      feature.setStyle({
        weight: weight,
        opacity: opacity
      });
    }
  }

  /**
   * Adds a Wkt geometry to the map.
   */
  function showFeatureWkt(el, geom, zoom, style) {
    var centre;
    var wkt = new Wkt.Wkt();
    var obj;
    var objStyle = {
      color: '#0000FF',
      opacity: 1.0,
      fillColor: '#0000FF',
      fillOpacity: 0.2
    };
    wkt.read(geom);
    if (style) {
      $.extend(objStyle, style);
    }
    obj = wkt.toObject(objStyle);
    obj.addTo(el.map);
    centre = typeof obj.getCenter === 'undefined' ? obj.getLatLng() : obj.getCenter();
    // Pan and zoom the map. Method differs for points vs polygons.
    if (!zoom) {
      el.map.panTo(centre);
    } else if (wkt.type === 'polygon') {
      el.map.fitBounds(obj.getBounds(), { maxZoom: 11 });
    } else {
      el.map.setView(centre, 11);
    }
    return obj;
  }

  /**
   * Select a grid row pans, optionally zooms and adds a marker.
   */
  function rowSelected(el, tr, zoom) {
    var doc;
    var obj;
    if (selectedRowMarker) {
      selectedRowMarker.removeFrom(el.map);
    }
    selectedRowMarker = null;
    if (tr) {
      doc = JSON.parse($(tr).attr('data-doc-source'));
      obj = showFeatureWkt(el, doc.location.geom, zoom);
      ensureFeatureClear(el, obj);
      selectedRowMarker = obj;
    }
  }

  /**
   * Allows map settings to be loaded from the browser cookies.
   *
   * Zoom, lat, long and selected base layer can all be remembered in cookies.
   */
  function loadSettingsFromCookies(cookieNames) {
    var val;
    var settings = {};
    if (typeof $.cookie !== 'undefined') {
      $.each(cookieNames, function eachCookie() {
        val = $.cookie(this);
        if (val !== null && val !== 'undefined') {
          settings[this] = val;
        }
      });
    }
    return settings;
  }

  /**
   * Declare public methods.
   */
  methods = {
    /**
     * Initialise the idcLeafletMap plugin.
     *
     * @param array options
     */
    init: function init(options) {
      var el = this;
      var source = JSON.parse($(el).attr('data-es-source'));
      var baseMaps;
      var overlays = {};
      var layersControl;
      el.outputLayers = {};

      indiciaFns.registerOutputPluginClass('idcLeafletMap');
      el.settings = $.extend({}, defaults);
      // Apply settings passed in the HTML data-* attribute.
      if (typeof $(el).attr('data-idc-config') !== 'undefined') {
        $.extend(el.settings, JSON.parse($(el).attr('data-idc-config')));
      }
      // Apply settings passed to the constructor.
      if (typeof options !== 'undefined') {
        $.extend(el.settings, options);
      }
      // Apply settings stored in cookies.
      if (el.settings.cookies) {
        $.extend(el.settings, loadSettingsFromCookies(['initialLat', 'initialLong', 'initialZoom', 'baseLayer']));
      }
      el.map = L.map(el.id).setView([el.settings.initialLat, el.settings.initialLng], el.settings.initialZoom);
      baseMaps = {
        OpenStreetMap: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }),
        OpenTopoMap: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
          maxZoom: 17,
          attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
            '<a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> ' +
            '(<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
        })
      };
      // Add the active base layer to the map.
      baseMaps[el.settings.baseLayer].addTo(el.map);
      $.each(source, function eachSource(id, title) {
        var group;
        if (el.settings.styles[id].type !== 'undefined' && el.settings.styles[id].type === 'heat') {
          group = L.heatLayer([], { radius: 10 });
        } else {
          group = L.featureGroup();
        }
        // Leaflet wants layers keyed by title.
        overlays[title] = group;
        // Plugin wants them keyed by source ID.
        el.outputLayers[id] = group;
        // Add the group to the map
        group.addTo(el.map);
      });
      layersControl = L.control.layers(baseMaps, overlays);
      layersControl.addTo(el.map);
      el.map.on('zoomend', function zoomEnd() {
        if (selectedRowMarker !== null) {
          ensureFeatureClear(el, selectedRowMarker);
        }
      });
      el.map.on('moveend', function moveEnd() {
        $.each(callbacks.moveend, function eachCallback() {
          this(el);
        });
        if (typeof $.cookie !== 'undefined' && el.settings.cookies) {
          $.cookie('initialLat', el.map.getCenter().lat);
          $.cookie('initialLng', el.map.getCenter().lng);
          $.cookie('initialZoom', el.map.getZoom());
        }
      });
      if (typeof $.cookie !== 'undefined' && el.settings.cookies) {
        el.map.on('baselayerchange', function baselayerchange(layer) {
          $.cookie('baseLayer', layer.name);
        });
      }
    },

    /*
     * Populate the map with Elasticsearch response data.
     *
     * @param obj sourceSettings
     *   Settings for the data source used to generate the response.
     * @param obj response
     *   Elasticsearch response data.
     * @param obj data
     *   Data sent in request.
     */
    populate: function populate(sourceSettings, response) {
      var el = this;
      var buckets;
      var maxMetric = 10;
      if (typeof el.outputLayers[sourceSettings.id].clearLayers !== 'undefined') {
        el.outputLayers[sourceSettings.id].clearLayers();
      } else {
        el.outputLayers[sourceSettings.id].setLatLngs([]);
      }
      // Are there document hits to map?
      $.each(response.hits.hits, function eachHit() {
        var latlon = this._source.location.point.split(',');
        addFeature(el, sourceSettings.id, latlon);
      });
      // Are there aggregations to map?
      if (typeof response.aggregations !== 'undefined') {
        buckets = indiciaFns.findValue(response.aggregations, 'buckets');
        if (typeof buckets !== 'undefined') {
          $.each(buckets, function eachBucket() {
            var count = indiciaFns.findValue(this, 'count');
            maxMetric = Math.max(Math.sqrt(count), maxMetric);
          });
          $.each(buckets, function eachBucket() {
            var location = indiciaFns.findValue(this, 'location');
            var count = indiciaFns.findValue(this, 'count');
            var metric = Math.round((Math.sqrt(count) / maxMetric) * 20000);
            if (typeof location !== 'undefined') {
              addFeature(el, sourceSettings.id, location, metric);
            }
          });
        }
      }
      if (sourceSettings.initialMapBounds && !$(el)[0].settings.initialBoundsSet) {
        if (typeof el.outputLayers[sourceSettings.id].getLayers !== 'undefined' &&
            el.outputLayers[sourceSettings.id].getLayers().length > 0) {
          el.map.fitBounds(el.outputLayers[sourceSettings.id].getBounds());
          $(el)[0].settings.initialBoundsSet = true;
        }
      }
    },

    /**
     * Binds to dataGrid callbacks.
     *
     * Binds to event handlers for row click (to select feature) and row double
     * click (to also zoom in).
     */
    bindGrids: function bindGrids() {
      var el = this;
      var settings = $(el)[0].settings;
      if (typeof settings.showSelectedRow !== 'undefined') {
        if ($('#' + settings.showSelectedRow).length === 0) {
          indiciaFns.controlFail(el, 'Invalid grid ID in @showSelectedRow parameter');
        }
        $('#' + settings.showSelectedRow).idcDataGrid('on', 'rowSelect', function onRowSelect(tr) {
          rowSelected(el, tr, false);
        });
        $('#' + settings.showSelectedRow).idcDataGrid('on', 'rowDblClick', function onRowDblClick(tr) {
          rowSelected(el, tr, true);
        });
      }
    },

    /**
     * Clears the selected feature boundary (e.g. a selected location).
     */
    clearFeature: function clearFeature() {
      if (selectedFeature) {
        selectedFeature.removeFrom($(this)[0].map);
        selectedFeature = null;
      }
    },

    /**
     * Shows a selected feature boundary (e.g. a selected location).
     * */
    showFeature: function showFeature(geom, zoom) {
      if (selectedFeature) {
        selectedFeature.removeFrom($(this)[0].map);
        selectedFeature = null;
      }
      selectedFeature = showFeatureWkt(this, geom, zoom, {
        color: '#7700CC',
        fillColor: '#7700CC',
        fillOpacity: 0.1
      });
    },

    /**
     * Hook up event handlers.
     */
    on: function on(event, handler) {
      if (typeof callbacks[event] === 'undefined') {
        indiciaFns.controlFail(this, 'Invalid event handler requested for ' + event);
      }
      callbacks[event].push(handler);
    }
  };

  /**
   * Extend jQuery to declare leafletMap method.
   */
  $.fn.idcLeafletMap = function buildLeafletMap(methodOrOptions) {
    var passedArgs = arguments;
    $.each(this, function callOnEachOutput() {
      if (methods[methodOrOptions]) {
        // Call a declared method.
        return methods[methodOrOptions].apply(this, Array.prototype.slice.call(passedArgs, 1));
      } else if (typeof methodOrOptions === 'object' || !methodOrOptions) {
        // Default to "init".
        return methods.init.apply(this, passedArgs);
      }
      // If we get here, the wrong method was called.
      $.error('Method ' + methodOrOptions + ' does not exist on jQuery.idcLeafletMap');
      return true;
    });
    return this;
  };
}());
