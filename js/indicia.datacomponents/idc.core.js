/**
 * @file
 * Core functionality for the indicia.datacomponents library,
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

 /* eslint no-underscore-dangle: ["error", { "allow": ["_id", "_source", "_latlng"] }] */
 /* eslint no-extend-native: ["error", { "exceptions": ["String"] }] */

(function enclose() {
  'use strict';
  var $ = jQuery;

  /**
   * Extend the String class to simplify a column fieldname string.
   *
   * For special column handlers, a fieldname can be given as the following
   * format:
   * #fieldname:param1:param2:...#
   * This function will return just fieldname.
   */
  String.prototype.simpleFieldName = function simpleFieldName() {
    return this.replace(/#/g, '').split(':')[0];
  };

  /**
   * Keep track of a list of all the plugin instances that output something.
   */
  indiciaData.outputPluginClasses = [];

  /**
   * List of the Elasticsearch bound sources.
   */
  indiciaData.esSourceObjects = {};

  /**
   * Font Awesome icon and other classes for record statuses and flags.
   */
  indiciaData.statusClasses = {
    V: 'far fa-check-circle status-V',
    V1: 'far fa-check-double status-V1',
    V2: 'fas fa-check status-V2',
    C: 'fas fa-clock status-C',
    C3: 'fas fa-check-square status-C3',
    R: 'far fa-times-circle status-R',
    R4: 'fas fa-times status-R4',
    R5: 'fas fa-times status-R5',
    // Additional flags
    Q: 'fas fa-question-circle',
    A: 'fas fa-reply',
    Sensitive: 'fas fa-exclamation-circle',
    Confidential: 'fas fa-exclamation-triangle'
  };

  /**
   * Messages for record statuses and other flags.
   */
  indiciaData.statusMsgs = {
    V: 'Accepted',
    V1: 'Accepted as correct',
    V2: 'Accepted as considered correct',
    C: 'Pending review',
    C3: 'Plausible',
    R: 'Not accepted',
    R4: 'Not accepted as unable to verify',
    R5: 'Not accepted as incorrect',
    // Additional flags
    Q: 'Queried',
    A: 'Answered',
    Sensitive: 'Sensitive',
    Confidential: 'Confidential'
  };

  /**
   * Font Awesome icon classes for verification automatic check rules.
   */
  indiciaData.ruleClasses = {
    WithoutPolygon: 'fas fa-globe',
    PeriodWithinYear: 'far fa-calendar-times',
    IdentificationDifficulty: 'fas fa-microscope',
    default: 'fas fa-ruler',
    pass: 'fas fa-thumbs-up',
    fail: 'fas fa-thumbs-down',
    pending: 'fas fa-cog',
    checksDisabled: 'fas fa-eye-slash'
  };

  /**
   * Initially populate the data sources.
   */
  indiciaFns.populateDataSources = function populateDataSources() {
    // Build the Elasticsearch source objects and run initial population.
    $.each(indiciaData.esSources, function eachSource() {
      var sourceObject = new IdcEsDataSource(this);
      indiciaData.esSourceObjects[this.id] = sourceObject;
      sourceObject.populate();
    });
  };

  /**
   * Keep track of a unique list of output plugin classes active on the page.
   */
  indiciaFns.registerOutputPluginClass = function registerOutputPluginClasses(name) {
    if ($.inArray(name, indiciaData.outputPluginClasses) === -1) {
      indiciaData.outputPluginClasses.push(name);
    }
  };

  /**
   * Function to flag an output plugin as failed.
   *
   * Places an error message before the plugin instance then throws a message.
   *
   * @param object el
   *   Plugin element.
   * @param string msg
   *   Failure message.
   */
  indiciaFns.controlFail = function controlFail(el, msg) {
    $(el).before('<p class="alert alert-danger">' +
      '<span class="fas fa-exclamation-triangle fa-2x"></span>Error loading control' +
      '</p>');
    throw new Error(msg);
  };

  /**
   * Convert an ES (ISO) date to local display format.
   *
   * @param string dateString
   *   Date as returned from ES date field.
   *
   * @return string
   *   Date formatted.
   */
  indiciaFns.formatDate = function formatDate(dateString) {
    var date;
    var month;
    var day;
    if (dateString.trim() === '') {
      return '';
    }
    date = new Date(dateString);
    month = (1 + date.getMonth()).toString();
    month = month.length > 1 ? month : '0' + month;
    day = date.getDate().toString();
    day = day.length > 1 ? day : '0' + day;
    return indiciaData.dateFormat
      .replace('d', day)
      .replace('m', month)
      .replace('Y', date.getFullYear());
  };

  /**
   * Utility function to retrieve status icon HTML from a status code.
   *
   * @param object flags
   *   Array of flags, including any of:
   *   * status
   *   * substatus
   *   * query
   *   * sensitive
   *   * confidential
   * @param string iconClass
   *   Additional class to add to the icons, e.g. fa-2x.
   *
   * @return string
   *   HTML for the icons.
   */
  indiciaFns.getEsStatusIcons = function getEsStatusIcons(flags, iconClass) {
    var html = '';
    var fullStatus;

    var addIcon = function addIcon(flag) {
      var classes = [];
      if (typeof indiciaData.statusClasses[flag] !== 'undefined') {
        classes = [indiciaData.statusClasses[flag]];
        if (iconClass) {
          classes.push(iconClass);
        }
        html += '<span title="' + indiciaData.statusMsgs[flag] + '" class="' + classes.join(' ') + '"></span>';
      }
    };
    // Add the record status icon.
    if (flags.status) {
      fullStatus = flags.status + (!flags.substatus || flags.substatus === '0' ? '' : flags.substatus);
      addIcon(fullStatus);
    }
    // Add other metadata icons as required.
    if (flags.query) {
      addIcon(flags.query);
    }
    if (flags.sensitive && flags.sensitive !== 'false') {
      addIcon('Sensitive');
    }
    if (flags.confidential && flags.confidential !== 'false') {
      addIcon('Confidential');
    }
    return html;
  };

  /**
   * Searches an object for a nested property.
   *
   * Useful for finding the buckets property of an aggregation for example.
   *
   * @return mixed
   *   Property value.
   */
  indiciaFns.findValue = function findValue(object, key) {
    var value;
    Object.keys(object).some(function eachKey(k) {
      if (k === key) {
        value = object[k];
        return true;
      }
      if (object[k] && typeof object[k] === 'object') {
        value = indiciaFns.findValue(object[k], key);
        return value !== undefined;
      }
      return false;
    });
    return value;
  };

  /**
   * Searches an object for a nested property and sets its value.
   *
   * @return mixed
   *   Property value.
   */
  indiciaFns.findAndSetValue = function findAndSetValue(object, key, updateValue) {
    var value;
    Object.keys(object).some(function eachKey(k) {
      if (k === key) {
        object[k] = updateValue;
        return true;
      }
      if (object[k] && typeof object[k] === 'object') {
        value = indiciaFns.findAndSetValue(object[k], key, updateValue);
        return value !== undefined;
      }
      return false;
    });
    return value;
  };

  /**
   * A list of functions which provide HTML generation for special fields.
   *
   * These are field values in HTML that can be extracted from an Elasticsearch
   * doc which are not simple values.
   */
  indiciaFns.fieldConvertors = {
    /**
     * Record status and other flag icons.
     */
    status_icons: function statusIcons(doc) {
      return indiciaFns.getEsStatusIcons({
        status: doc.identification.verification_status,
        substatus: doc.identification.verification_substatus,
        query: doc.identification.query ? doc.identification.query : '',
        sensitive: doc.metadata.sensitive,
        confidential: doc.metadata.confidential
      });
    },

    /**
     * Data cleaner automatic rule check result icons.
     */
    data_cleaner_icons: function dataCleanerIcons(doc) {
      var autoChecks = doc.identification.auto_checks;
      var icons = [];
      if (autoChecks.enabled === 'false') {
        icons.push('<span title="Automatic rule checks will not be applied to records in this dataset." class="' + indiciaData.ruleClasses.checksDisabled + '"></span>');
      } else if (autoChecks.result === 'true') {
        icons.push('<span title="All automatic rule checks passed." class="' + indiciaData.ruleClasses.pass + '"></span>');
      } else if (autoChecks.result === 'false') {
        if (autoChecks.output.length > 0) {
          icons = ['<span title="The following automatic rule checks were triggered for this record." class="' + indiciaData.ruleClasses.fail + '"></span>'];
          // Add an icon for each rule violation.
          $.each(autoChecks.output, function eachViolation() {
            // Set a default for any other rules.
            var icon = Object.prototype.hasOwnProperty.call(indiciaData.ruleClasses, this.rule_type)
              ? indiciaData.ruleClasses[this.rule_type] : indiciaData.ruleClasses.default;
            icons.push('<span title="' + this.message + '" class="' + icon + '"></span>');
          });
        }
      } else {
        // Not yet checked.
        icons.push('<span title="Record not yet checked against rules." class="' + indiciaData.ruleClasses.pending + '"></span>');
      }
      return icons.join('');
    },

    /**
     * Output the event date or date range.
     */
    event_date: function eventDate(doc) {
      if (doc.event.date_start !== doc.event.date_end) {
        return indiciaFns.formatDate(doc.event.date_start) + ' - ' + indiciaFns.formatDate(doc.event.date_end);
      }
      return indiciaFns.formatDate(doc.event.date_start);
    },

    /**
     * Output a higher geography value.
     *
     * The column should be configured with two parameters, the first is the
     * type (e.g. Vice county) and the second the field to return (e.g. name,
     * code). For example:
     * {"caption":"VC code","field":"#higher_geography:Vice County:code#"}
     */
    higher_geography: function higherGeography(doc, params) {
      var output = '';
      if (doc.location.higher_geography) {
        $.each(doc.location.higher_geography, function eachGeography() {
          if (this.type === params[0]) {
            output = this[params[1]];
          }
        });
      }
      return output;
    },

    /**
     * A summary of location information.
     *
     * Includes the given location name (verbatim locality) as well as list of
     * higher geography.
     */
    locality: function locality(doc) {
      var info = '';
      if (doc.location.verbatim_locality) {
        info += '<div>' + doc.location.verbatim_locality + '</div>';
        if (doc.location.higher_geography) {
          info += '<ul>';
          $.each(doc.location.higher_geography, function eachPlace() {
            info += '<li>' + this.type + ': ' + this.name + '</li>';
          });
          info += '</ul>';
        }
      }
      return info;
    },

    /**
     * A simple output of website and survey ID.
     *
     * Has a hint to show the underlying titles.
     */
    datasource_code: function datasourceCode(doc) {
      return '<abbr title="' + doc.metadata.website.title + ' | ' + doc.metadata.survey.title + '">' +
        doc.metadata.website.id + '|' + doc.metadata.survey.id +
        '</abbr>';
    }
  };

  /**
   * Special fields provided by field convertors are not searchable unless a
   * dedicated function is provided to build an appropriate query string for
   * the user input.
   *
   * This list could also potentially override the search behaviour for normal
   * mapped fields.
   *
   * Builders should return:
   * * false if the input text is not a valid filter.
   * * a string suitable for use as a query_string.
   * * an object that defines any filter suitable for adding to the bool
   *   queries array.
   * The builder can assume that the input text value is already trimmed.
   */
  indiciaFns.fieldConvertorQueryBuilders = {
    /**
     * Handle datasource_code filtering in format website_id [| survey ID].
     */
    datasource_code: function datasourceCode(text) {
      var parts;
      var query;
      if (text.match(/^\d+(\s*\|\s*\d*)?$/)) {
        parts = text.split('|');
        // Search always includes the website ID.
        query = 'metadata.website.id:' + parts[0].trim();
        // Search can optionally include the survey ID.
        if (parts.length > 1 && parts[1].trim() !== '') {
          query += 'AND metadata.survey.id:' + parts[1].trim();
        }
        return query;
      }
      return false;
    },

    /**
     * Event date filtering.
     *
     * Supports yyyy, mm/dd/yyyy or yyyy-mm-dd formats.
     */
    event_date: function eventDate(text) {
      // A series of possible date patterns, with the info required to build
      // a query string.
      var tests = [
        {
          // yyyy format.
          pattern: '(\\d{4})',
          field: 'event.year',
          format: '{1}'
        },
        {
          // dd/mm/yyyy format.
          pattern: '(\\d{2})\\/(\\d{2})\\/(\\d{4})',
          field: 'event.date_start',
          format: '{3}-{2}-{1}'
        },
        {
          // yyyy-mm-dd format.
          pattern: '(\\d{4})\\-(\\d{2})\\-(\\d{2})',
          field: 'event.date_start',
          format: '{1}-{2}-{3}'
        }
      ];
      var filter = false;
      // Loop the patterns to find a match.
      $.each(tests, function eachTest() {
        var regex = new RegExp('^' + this.pattern + '$');
        var match = text.match(regex);
        var value = this.format;
        var i;
        if (match) {
          // Got a match, so reformat and build the filter string.
          for (i = 1; i < match.length; i++) {
            value = value.replace('{' + i + '}', match[i]);
          }
          filter = this.field + ':' + value;
          // Abort the search.
          return false;
        }
        return true;
      });
      return filter;
    },

    /**
     * Builds a nested query for higher geography columns.
     */
    higher_geography: function higherGeography(text, params) {
      var filter = {};
      var query;
      filter['location.higher_geography.' + params[1]] = text;
      query = {
        nested: {
          path: 'location.higher_geography',
          query: {
            bool: {
              must: [
                { match: { 'location.higher_geography.type': params[0] } },
                { match: filter }
              ]
            }
          }
        }
      };
      return {
        bool_clause: 'must',
        value: '',
        query: JSON.stringify(query)
      };
    }
  };

  /**
   * Field convertors which allow sort on underlying fields are listed here.
   */
  indiciaData.fieldConvertorSortFields = {
    // Unsupported possibilities are commented out.
    // status_icons: []
    // data_cleaner_icons: [],
    event_date: ['event.date_start'],
    // higher_geography: [],
    // locality: [],
    datasource_code: ['metadata.website.id', 'metadata.survey.id']
  };

  /**
   * Retrieves a field value from the document.
   *
   * @param object doc
   *   Document read from Elasticsearch.
   * @param string field
   *   Name of the field. Either a path to the field in the document (such as
   *   taxon.accepted_name) or a special field name surrounded by # characters,
   *   e.g. #locality.
   */
  indiciaFns.getValueForField = function getValueForField(doc, field) {
    var i;
    var valuePath = doc;
    var fieldPath = field.split('.');
    var convertor;
    // Special field handlers are in the list of convertors.
    if (field.match(/^#/)) {
      // Find the convertor definition between the hashes. If there are
      // colons, stuff that follows the first colon are parameters.
      convertor = field.replace(/^#(.+)#$/, '$1').split(':');
      if (typeof indiciaFns.fieldConvertors[convertor[0]] !== 'undefined') {
        return indiciaFns.fieldConvertors[convertor[0]](doc, convertor.slice(1));
      }
    }
    // If not a special field, work down the document hierarchy according to
    // the field's path components.
    for (i = 0; i < fieldPath.length; i++) {
      if (typeof valuePath[fieldPath[i]] === 'undefined') {
        valuePath = '';
        break;
      }
      valuePath = valuePath[fieldPath[i]];
    }
    // Reformat date fields to user-friendly format.
    // @todo Localisation for non-UK dates.
    if (field.match(/_on$/)) {
      valuePath = valuePath.replace(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}).*/, '$3/$2/$1 $4:$5');
    }
    return valuePath;
  };

  /**
   * Build query data to send to ES proxy.
   *
   * Builds the data to post to the Elasticsearch search proxy to represent
   * the current state of the form inputs on the page.
   */
  indiciaFns.getFormQueryData = function getFormQueryData(source) {
    var data = {
      warehouse_url: indiciaData.warehouseUrl,
      filters: {},
      bool_queries: [],
      user_filters: []
    };
    var mapToFilterTo;
    var bounds;
    var filterSourceGrid;
    var filterSourceRow;
    var thisDoc;
    if (source.settings.size) {
      data.size = source.settings.size;
    }
    if (source.settings.from) {
      data.from = source.settings.from;
    }
    if (source.settings.sort) {
      data.sort = source.settings.sort;
    }
    if (source.settings.filterBoolClauses) {
      // Using filter paremeter controls.
      $.each(source.settings.filterBoolClauses, function eachBoolClause(type, filters) {
        $.each(filters, function eachFilter() {
          data.bool_queries.push({
            bool_clause: type,
            query_type: this.query_type,
            field: this.field ? this.field : null,
            query: this.query ? this.query : null,
            value: this.value ? this.value : null
          });
        });
      });
    }
    if (source.settings.filterSourceGrid && source.settings.filterField) {
      // Using a grid row as a filter.
      filterSourceGrid = $('#' + source.settings.filterSourceGrid);
      if (filterSourceGrid.length === 0) {
        alert('Invalid @filterSourceGrid setting for source. Grid with id="' +
          source.settings.filterSourceGrid + '" does not exist.');
      }
      filterSourceRow = $(filterSourceGrid).find('tbody tr.selected');
      if (filterSourceRow.length === 0) {
        // Don't populate until a row selected.
        data.bool_queries.push({
          bool_clause: 'must',
          query_type: 'match_none'
        });
      } else {
        thisDoc = JSON.parse($(filterSourceRow).attr('data-doc-source'));
        data.bool_queries.push({
          bool_clause: 'must',
          field: source.settings.filterField,
          query_type: 'term',
          value: indiciaFns.getValueForField(thisDoc, source.settings.filterField)
        });
      }
    } else {
      // Using filter paremeter controls.
      $.each($('.es-filter-param'), function eachParam() {
        if ($(this).val().trim() !== '') {
          data.bool_queries.push({
            bool_clause: $(this).attr('data-es-bool-clause'),
            field: $(this).attr('data-es-field') ? $(this).attr('data-es-field') : null,
            query_type: $(this).attr('data-es-query-type'),
            query: $(this).attr('data-es-query') ? $(this).attr('data-es-query') : null,
            value: $(this).val().trim()
          });
        }
      });
      if (typeof source.outputs.idcDataGrid !== 'undefined') {
        $.each(source.outputs.idcDataGrid, function eachGrid() {
          var filterRow = $(this).find('.es-filter-row');
          // Remove search text format errors.
          $(filterRow).find('.fa-exclamation-circle').remove();
          // Build the filter required for values in each filter row input.
          $.each($(filterRow).find('input'), function eachInput() {
            var el = $(this).closest('.idc-output');
            var cell = $(this).closest('td');
            var col = $(el)[0].settings.columns[$(cell).attr('data-col')];
            var fnQueryBuilder;
            var query;
            var fieldNameParts;
            var fn;
            if ($(this).val().trim() !== '') {
              // If there is a special field name, break it into the name
              // + parameters.
              fieldNameParts = col.field.replace(/#/g, '').split(':');
              // Remove the convertor name from the start of the array,
              // leaving the parameters.
              fn = fieldNameParts.shift();
              if (typeof indiciaFns.fieldConvertorQueryBuilders[fn] !== 'undefined') {
                // A special field with a convertor function.
                fnQueryBuilder = indiciaFns.fieldConvertorQueryBuilders[fn];
                query = fnQueryBuilder($(this).val().trim(), fieldNameParts);
                if (query === false) {
                  // Flag input as invalid.
                  $(this).after('<span title="Invalid search text" class="fas fa-exclamation-circle"></span>');
                } else if (typeof query === 'object') {
                  // Query is an object, so use it as is.
                  data.bool_queries.push(query);
                } else {
                  // Query is a string, so treat as a query_string.
                  data.bool_queries.push({
                    bool_clause: 'must',
                    query_type: 'query_string',
                    value: query
                  });
                }
              } else {
                // A normal mapped field with no special handling.
                data.filters[col.field] = $(this).val().trim();
              }
            }
          });
        });
      }
      if ($('.user-filter').length > 0) {
        $.each($('.user-filter'), function eachUserFilter() {
          if ($(this).val()) {
            data.user_filters.push($(this).val());
          }
        });
      }
      if ($('.permissions-filter').length > 0) {
        data.permissions_filter = $('.permissions-filter').val();
      }
    }
    if (source.settings.aggregation) {
      // Find the map bounds if limited to the viewport of a map.
      if (source.settings.filterBoundsUsingMap) {
        mapToFilterTo = $('#' + source.settings.filterBoundsUsingMap);
        if (mapToFilterTo.length === 0 || !mapToFilterTo[0].map) {
          alert('Data source incorrectly configured. @filterBoundsUsingMap does not point to a valid map.');
        } else {
          bounds = mapToFilterTo[0].map.getBounds();
          indiciaFns.findAndSetValue(source.settings.aggregation, 'geo_bounding_box', {
            ignore_unmapped: true,
            'location.point': {
              top_left: {
                lat: bounds.getNorth(),
                lon: bounds.getWest()
              },
              bottom_right: {
                lat: bounds.getSouth(),
                lon: bounds.getEast()
              }
            }
          });
          indiciaFns.findAndSetValue(source.settings.aggregation, 'geohash_grid', {
            field: 'location.point',
            precision: Math.min(Math.max(mapToFilterTo[0].map.getZoom() - 3, 4), 10)
          });
        }
      }
      data.aggs = source.settings.aggregation;
    }
    return data;
  };
}());

jQuery(document).ready(function docReady() {
  'use strict';
  var $ = jQuery;

  // Hook up higher geography controls.
  $('.es-higher-geography-select').addClass('es-filter-param');
  $('.es-higher-geography-select').attr('data-es-bool-clause', 'must');
  $('.es-higher-geography-select').attr('data-es-query', JSON.stringify({
    nested: {
      path: 'location.higher_geography',
      query: {
        bool: {
          must: [
            { match: { 'location.higher_geography.id': '#value#' } }
          ]
        }
      }
    }
  }));
  $('.es-higher-geography-select').change(function higherGeoSelectChange() {
    if ($(this).val()) {
      $.getJSON(indiciaData.warehouseUrl + 'index.php/services/report/requestReport?' +
          'report=library/locations/location_boundary_projected.xml' +
          '&reportSource=local&srid=4326&location_id=' + $(this).val() +
          '&nonce=' + indiciaData.read.nonce + '&auth_token=' + indiciaData.read.auth_token +
          '&mode=json&callback=?', function getLoc(data) {
        $.each($('.idc-leaflet-map'), function eachMap() {
          $(this).indiciaMap('showFeature', data[0].boundary_geom, true);
        });
      });
    } else {
      $(this).indiciaMap('clearFeature');
    }
  });

  $('.es-filter-param, .user-filter, .permissions-filter').change(function eachFilter() {
    // Force map to update viewport for new data.
    $.each($('.idc-output-idcLeafletMap'), function eachMap() {
      this.settings.initialBoundsSet = false;
    });
    // Reload all sources.
    $.each(indiciaData.esSourceObjects, function eachSource() {
      // Reset to first page.
      this.settings.from = 0;
      this.populate();
    });
  });
});