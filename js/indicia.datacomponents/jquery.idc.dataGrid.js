/**
 * @file
 * A data grid plugin.
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

/**
 * Output plugin for data grids.
 */
(function idcDataGridPlugin() {
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
    actions: [],
    includeColumnHeadings: true,
    includeFilterRow: true,
    includePager: true,
    sortable: true
  };

  /**
   * Registered callbacks for different events.
   */
  var callbacks = {
    rowSelect: [],
    rowDblClick: [],
    populate: []
  };

  /**
   * Register the various user interface event handlers.
   */
  function initHandlers(el) {
    indiciaFns.on('click', '#' + el.id + ' .es-data-grid tbody tr', {}, function onDataGridRowClick() {
      var tr = this;
      $(tr).closest('tbody').find('tr.selected').removeClass('selected');
      $(tr).addClass('selected');
      $.each(callbacks.rowSelect, function eachCallback() {
        this(tr);
      });
    });

    indiciaFns.on('dblclick', '#' + el.id + ' .es-data-grid tbody tr', {}, function onDataGridRowDblClick() {
      var tr = this;
      if (!$(tr).hasClass('selected')) {
        $(tr).closest('tbody').find('tr.selected').removeClass('selected');
        $(tr).addClass('selected');
      }
      $.each(callbacks.rowDblClick, function eachCallback() {
        this(tr);
      });
    });

    $(el).find('.pager .next').click(function clickNext() {
      $.each(el.settings.source, function eachSource(sourceId) {
        var source = indiciaData.esSourceObjects[sourceId];
        if (typeof source.settings.from === 'undefined') {
          source.settings.from = 0;
        }
        // Move to next page based on currently visible row count, in case some
        // have been removed.
        source.settings.from += $(el).find('tbody tr.data-row').length;
        source.populate();
      });
    });

    $(el).find('.pager .prev').click(function clickPrev() {
      $.each(el.settings.source, function eachSource(sourceId) {
        var source = indiciaData.esSourceObjects[sourceId];
        if (typeof source.settings.from === 'undefined') {
          source.settings.from = 0;
        }
        source.settings.from -= source.settings.size;
        source.settings.from = Math.max(0, source.settings.from);
        source.populate();
      });
    });

    $(el).find('.sort').click(function clickSort() {
      var sortButton = this;
      var row = $(sortButton).closest('tr');
      $.each(el.settings.source, function eachSource(sourceId) {
        var source = indiciaData.esSourceObjects[sourceId];
        var idx = $(sortButton).closest('th').attr('data-col');
        var col = $(el)[0].settings.columns[idx];
        var sortDesc = $(sortButton).hasClass('fa-sort-up');
        var fields;
        var fieldName = col.field.simpleFieldName();
        $(row).find('.sort.fas').removeClass('fa-sort-down');
        $(row).find('.sort.fas').removeClass('fa-sort-up');
        $(row).find('.sort.fas').addClass('fa-sort');
        $(sortButton).removeClass('fa-sort');
        $(sortButton).addClass('fa-sort-' + (sortDesc ? 'down' : 'up'));
        source.settings.sort = {};
        if (indiciaData.esMappings[fieldName]) {
          source.settings.sort[indiciaData.esMappings[fieldName].sort_field] = {
            order: sortDesc ? 'desc' : 'asc'
          };
        } else if (indiciaData.fieldConvertorSortFields[fieldName]) {
          fields = indiciaData.fieldConvertorSortFields[fieldName];
          $.each(fields, function eachField() {
            source.settings.sort[this] = {
              order: sortDesc ? 'desc' : 'asc'
            };
          });
        }
        source.populate();
      });
    });

    $(el).find('.es-filter-row input').change(function changeFilterInput() {
      $.each(el.settings.source, function eachSource(sourceId) {
        var source = indiciaData.esSourceObjects[sourceId];
        // Reset to first page.
        source.settings.from = 0;
        source.populate();
      });
    });

    $(el).find('.multiselect-switch').click(function clickMultiselectSwitch() {
      var table = $(this).closest('table');
      if ($(table).hasClass('multiselect-mode')) {
        $(table).removeClass('multiselect-mode');
        $(table).find('.multiselect-cell').remove();
        $('.selection-buttons-placeholder').append($('.all-selected-buttons'));
      } else {
        $(table).addClass('multiselect-mode');
        $(table).find('thead tr').prepend(
          '<th class="multiselect-cell" />'
        );
        $(table).find('thead tr:first-child th:first-child').append(
          '<input type="checkbox" class="multiselect-all" />'
        );
        $(table).find('tbody tr').prepend(
          '<td class="multiselect-cell"><input type="checkbox" class="multiselect" /></td>'
        );
        $(table).closest('div').prepend(
          $('.all-selected-buttons')
        );
      }
    });

    indiciaFns.on('click', '.multiselect-all', {}, function onClick(e) {
      var table = $(e.currentTarget).closest('table');
      if ($(e.currentTarget).is(':checked')) {
        table.find('.multiselect').prop('checked', true);
      } else {
        $(table).find('.multiselect').prop('checked', false);
      }
    });
  }

  /**
   * Retrieve any action links to attach to an idcDataGrid row.
   *
   * @param array actions
   *   List of actions from configuration.
   * @param object doc
   *   The ES document for the row.
   *
   * @return string
   *   Action link HTML.
   */
  function getActionsForRow(actions, doc) {
    var html = '';
    $.each(actions, function eachActions() {
      var item;
      var link;
      if (typeof this.title === 'undefined') {
        html += '<span class="fas fa-times-circle error" title="Invalid action definition - missing title"></span>';
      } else {
        if (this.iconClass) {
          item = '<span class="' + this.iconClass + '" title="' + this.title + '"></span>';
        } else {
          item = this.title;
        }
        if (this.path) {
          link = this.path.replace('{rootFolder}', indiciaData.rootFolder);
          if (this.urlParams) {
            link += link.indexOf('?') === -1 ? '?' : '&';
            $.each(this.urlParams, function eachParam(name, value) {
              // Find any field name replacements.
              var fieldMatches = value.match(/\[(.*?)\]/g);
              var updatedVal = value;
              $.each(fieldMatches, function eachMatch(i, fieldToken) {
                var dataVal;
                // Cleanup the square brackets which are not part of the field name.
                var field = fieldToken.replace(/\[/, '').replace(/\]/, '');
                dataVal = indiciaFns.getValueForField(doc, field);
                updatedVal = value.replace(fieldToken, dataVal);
              });
              link += name + '=' + updatedVal;
            });
          }
          item = '<a href="' + link + '" title="' + this.title + '">' + item + '</a>';
        }
        html += item;
      }
    });
    return html;
  }

  /**
   * Declare public methods.
   */
  methods = {
    /**
     * Initialise the idcDataGrid plugin.
     *
     * @param array options
     */
    init: function init(options) {
      var table;
      var header;
      var headerRow;
      var filterRow;
      var el = this;
      var totalCols;
      var showingAggregation;
      var footableSort;
      indiciaFns.registerOutputPluginClass('idcDataGrid');
      el.settings = $.extend({}, defaults);
      // Apply settings passed in the HTML data-* attribute.
      if (typeof $(el).attr('data-idc-config') !== 'undefined') {
        $.extend(el.settings, JSON.parse($(el).attr('data-idc-config')));
      }
      // Apply settings passed to the constructor.
      if (typeof options !== 'undefined') {
        $.extend(el.settings, options);
      }
      // Validate settings.
      if (typeof el.settings.columns === 'undefined') {
        indiciaFns.controlFail(el, 'Missing columns config for table.');
      }
      showingAggregation = el.settings.simpleAggregation || el.settings.sourceTable;
      footableSort = showingAggregation && el.settings.sortable ? 'true' : 'false';
      // Build the elements required for the table.
      table = $('<table class="table es-data-grid" data-sort="' + footableSort + '" />').appendTo(el);
      // If we need any sort of header, add <thead>.
      if (el.settings.includeColumnHeadings !== false || el.settings.includeFilterRow !== false) {
        header = $('<thead/>').appendTo(table);
        // Output header row for column titles.
        if (el.settings.includeColumnHeadings !== false) {
          headerRow = $('<tr/>').appendTo(header);
          $.each(el.settings.columns, function eachColumn(idx) {
            var heading = this.caption;
            var footableExtras = '';
            var sortableField = typeof indiciaData.esMappings[this.field] !== 'undefined'
              && indiciaData.esMappings[this.field].sort_field;
            sortableField = sortableField
              || indiciaData.fieldConvertorSortFields[this.field.simpleFieldName()];
            if (el.settings.sortable !== false && sortableField) {
              heading += '<span class="sort fas fa-sort"></span>';
            }
            if (this.multiselect) {
              heading += '<span title="Enable multiple selection mode" class="fas fa-list multiselect-switch"></span>';
            }
            // Extra data attrs to support footable.
            if (this['data-hide']) {
              footableExtras = ' data-hide="' + this['data-hide'] + '"';
            }
            if (this['data-type']) {
              footableExtras += ' data-type="' + this['data-type'] + '"';
            }
            $('<th class="col-' + idx + '" data-col="' + idx + '"' + footableExtras + '>' + heading + '</th>').appendTo(headerRow);
          });
          if (el.settings.actions.length) {
            $('<th class="col-actions">Actions</th>').appendTo(headerRow);
          }
        }
        // Disable filter row for aggregations.
        el.settings.includeFilterRow = el.settings.includeFilterRow && !showingAggregation;
        // Output header row for filtering.
        if (el.settings.includeFilterRow !== false) {
          filterRow = $('<tr class="es-filter-row" />').appendTo(header);
          $.each(el.settings.columns, function eachColumn(idx) {
            var td = $('<td class="col-' + idx + '" data-col="' + idx + '"></td>').appendTo(filterRow);
            // No filter input if this column has no mapping unless there is a
            // special field function that can work out the query.
            if (typeof indiciaData.esMappings[this.field] !== 'undefined'
              || typeof indiciaFns.fieldConvertorQueryBuilders[this.field.simpleFieldName()] !== 'undefined') {
              $('<input type="text">').appendTo(td);
            }
          });
        }
      }
      // We always want a table body for the data.
      $('<tbody />').appendTo(table);
      // Output a footer if we want a pager.
      if (el.settings.includePager && !(el.settings.sourceTable || el.settings.simpleAggregation)) {
        totalCols = el.settings.columns.length + (el.settings.actions.length > 0 ? 1 : 0);
        $('<tfoot><tr class="pager"><td colspan="' + totalCols + '"><span class="showing"></span>' +
          '<span class="buttons"><button class="prev">Previous</button><button class="next">Next</button></span>' +
          '</td></tr></tfoot>').appendTo(table);
      }
      initHandlers(el);
      // Make grid responsive.
      $(table).indiciaFootableReport();
    },

    /**
     * Populate the data grid with Elasticsearch response data.
     *
     * @param obj sourceSettings
     *   Settings for the data source used to generate the response.
     * @param obj response
     *   Elasticsearch response data.
     * @param obj data
     *   Data sent in request.
     */
    populate: function populate(sourceSettings, response, data) {
      var el = this;
      var fromRowIndex = typeof data.from === 'undefined' ? 1 : (data.from + 1);
      var dataList;
      $(el).find('tbody tr').remove();
      $(el).find('.multiselect-all').prop('checked', false);
      if ($(el)[0].settings.sourceTable) {
        dataList = response[$(el)[0].settings.sourceTable];
      } else if ($(el)[0].settings.simpleAggregation === true && typeof response.aggregations !== 'undefined') {
        dataList = indiciaFns.findValue(response.aggregations, 'buckets');
      } else {
        dataList = response.hits.hits;
      }
      $.each(dataList, function eachHit() {
        var hit = this;
        var cells = [];
        var row;
        var media;
        var selectedClass;
        var doc = hit._source ? hit._source : hit;
        if (el.settings.blockIdsOnNextLoad && $.inArray(hit._id, el.settings.blockIdsOnNextLoad) !== -1) {
          // Skip the row if blocked. This is required because ES is only
          // near-instantaneous, so if we take an action on a record then
          // reload the grid, it is quite likely to re-appear.
          return true;
        }
        if ($(el).find('table.multiselect-mode').length) {
          cells.push('<td class="multiselect-cell"><input type="checkbox" class="multiselect" /></td>');
        }
        $.each(el.settings.columns, function eachColumn(idx) {
          var value;
          var rangeValue;
          var match;
          var sizeClass;
          var fieldClass = 'field-' + this.field.replace('.', '--').replace('_', '-');
          value = indiciaFns.getValueForField(doc, this.field);
          if (this.range_field) {
            rangeValue = indiciaFns.getValueForField(doc, this.range_field);
            if (value !== rangeValue) {
              value = value + ' to ' + rangeValue;
            }
          }
          if (value && this.handler && this.handler === 'media') {
            media = '';
            // Tweak image sizes if more than 1.
            sizeClass = value.length === 1 ? 'single' : 'multi';
            $.each(value, function eachFile(i, file) {
              // Check if an extenral URL.
              match = file.match(/^http(s)?:\/\/(www\.)?([a-z(\.kr)]+)/);
              if (match !== null) {
                // If so, is it iNat? We can work out the image file names if so.
                if (file.match(/^https:\/\/static\.inaturalist\.org/)) {
                  media += '<a ' +
                    'href="' + file.replace('/square.', '/large.') + '" ' +
                    'class="inaturalist fancybox" rel="group-' + doc.id + '">' +
                    '<img class="' + sizeClass + '" src="' + file + '" /></a>';
                } else {
                  media += '<a ' +
                    'href="' + file + '" class="social-icon ' + match[3].replace('.', '') + '"></a>';
                }
              } else if ($.inArray(file.split('.').pop(), ['mp3', 'wav']) > -1) {
                // Audio files can have a player control.
                media += '<audio controls ' +
                  'src="' + indiciaData.warehouseUrl + 'upload/' + file + '" type="audio/mpeg"/>';
              } else {
                // Standard link to Indicia image.
                media += '<a ' +
                  'href="' + indiciaData.warehouseUrl + 'upload/' + file + '" ' +
                  'class="fancybox" rel="group-' + doc.id + '">' +
                  '<img class="' + sizeClass + '" src="' + indiciaData.warehouseUrl + 'upload/thumb-' + file + '" />' +
                  '</a>';
              }
            });
            value = media;
          }
          cells.push('<td class="col-' + idx + ' ' + fieldClass + '">' + value + '</td>');
        });
        if (el.settings.actions.length) {
          cells.push('<td class="col-actions">' + getActionsForRow(el.settings.actions, doc) + '</td>');
        }
        selectedClass = (el.settings.selectIdsOnNextLoad && $.inArray(hit._id, el.settings.selectIdsOnNextLoad) !== -1)
          ? ' selected' : '';
        row = $('<tr class="data-row' + selectedClass + '" data-row-id="' + hit._id + '">'
           + cells.join('') +
           '</tr>').appendTo($(el).find('tbody'));
        $(row).attr('data-doc-source', JSON.stringify(hit._source));
        return true;
      });
      // Discard the list of IDs to block during this population as now done.
      el.settings.blockIdsOnNextLoad = false;
      // Set up the count info in the footer.
      if (response.hits.hits.length > 0) {
        $(el).find('tfoot .showing').html('Showing ' + fromRowIndex +
          ' to ' + (fromRowIndex + (response.hits.hits.length - 1)) + ' of ' + response.hits.total);
      } else {
        $(el).find('tfoot .showing').html('No hits');
      }
      // Enable or disable the paging buttons.
      if (fromRowIndex > 1) {
        $(el).find('.pager .prev').removeAttr('disabled');
      } else {
        $(el).find('.pager .prev').attr('disabled', 'disabled');
      }
      if (fromRowIndex + response.hits.hits.length < response.hits.total) {
        $(el).find('.pager .next').removeAttr('disabled');
      } else {
        $(el).find('.pager .next').attr('disabled', 'disabled');
      }
      // Fire any population callbacks.
      $.each(callbacks.populate, function eachCallback() {
        this(el);
      });
      // Fire callbacks for selected row if any.
      $.each(callbacks.rowSelect, function eachCallback() {
        this($(el).find('tr.selected').length === 0 ? null : $(el).find('tr.selected')[0]);
      });
    },

    /**
     * Register an event handler.
     * @param string event
     *   Event name.
     * @param function handler
     *   Callback function called on this event.
     */
    on: function on(event, handler) {
      if (typeof callbacks[event] === 'undefined') {
        indiciaFns.controlFail(this, 'Invalid event handler requested for ' + event);
      }
      callbacks[event].push(handler);
    },

    /**
     * Hides a row and moves to next row.
     *
     * When an action is taken on a row so it is no longer required in the grid
     * this method hides the row and moves to the next row, for example after
     * a verification accept.
     */
    hideRowAndMoveNext: function hideRowAndMoveNext() {
      var grid = this;
      var oldSelected = $(grid).find('tr.selected');
      var newSelectedId;
      var showingLabel = $(grid).find('.showing');
      var blocked = [];

      if ($(grid).find('table.multiselect-mode').length > 0) {
        $.each($(grid).find('input.multiselect:checked'), function eachRow() {
          var tr = $(this).closest('tr');
          blocked.push($(tr).attr('data-row-id'));
          tr.remove();
        });
      } else {
        if ($(oldSelected).next('tr').length > 0) {
          newSelectedId = $(oldSelected).next('tr').attr('data-row-id');
        } else if ($(oldSelected).prev('tr').length > 0) {
          newSelectedId = $(oldSelected).prev('tr').attr('data-row-id');
        }
        blocked.push($(oldSelected).attr('data-row-id'));
        $(oldSelected).remove();
      }
      $.each(grid.settings.source, function eachSource(sourceId) {
        var source = indiciaData.esSourceObjects[sourceId];
        if ($(grid).find('table tbody tr.data-row').length < source.settings.size * 0.75) {
          $(grid)[0].settings.blockIdsOnNextLoad = blocked;
          $(grid)[0].settings.selectIdsOnNextLoad = [newSelectedId];
          source.populate(true);
        } else {
          // Update the paging info if some rows left.
          showingLabel.html(showingLabel.html().replace(/\d+ of /, $(grid).find('tbody tr.data-row').length + ' of '));
          // Immediately select the next row.
          if (typeof newSelectedId !== 'undefined') {
            $(grid).find('table tbody tr.data-row[data-row-id="' + newSelectedId + '"]').addClass('selected');
          }
          // Fire callbacks for selected row.
          $.each(callbacks.rowSelect, function eachCallback() {
            this($(grid).find('tr.selected').length === 0 ? null : $(grid).find('tr.selected')[0]);
          });
        }
      });
    }
  };

  /**
   * Extend jQuery to declare idcDtaGrid plugin.
   */
  $.fn.idcDataGrid = function buildDataGrid(methodOrOptions) {
    var passedArgs = arguments;
    $.each(this, function callOnEachGrid() {
      if (methods[methodOrOptions]) {
        // Call a declared method.
        return methods[methodOrOptions].apply(this, Array.prototype.slice.call(passedArgs, 1));
      } else if (typeof methodOrOptions === 'object' || !methodOrOptions) {
        // Default to "init".
        return methods.init.apply(this, passedArgs);
      }
      // If we get here, the wrong method was called.
      $.error('Method ' + methodOrOptions + ' does not exist on jQuery.idcDataGrid');
      return true;
    });
    return this;
  };
}());
