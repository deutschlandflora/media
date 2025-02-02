/**
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
 */

/**
 * Helper methods for additional JavaScript functionality required by the species_checklist control.
 * formatter - The taxon label template, OR a JavaScript function that takes an item returned by the web service
 * search for a species when adding rows to the grid, and returns a formatted taxon label. Overrides the label
 * template and controls the appearance of the species name both in the autocomplete for adding new rows, plus for
  the newly added rows.
 */

var mainSpeciesValue = null;
var formatter;

/*
Javascript functions using jQuery now need to be defined inside a "(function ($) { }) (jQuery);" wrapper.
This means they cannot normally be seen by the outside world, so in order to make a call to one of these
functions, we need to assign it to a global variable. */

var addRowToGrid;
var keyHandler;
var ConvertControlsToPopup;
var hook_species_checklist_new_row = [];
var hook_species_checklist_pre_delete_row = [];
var hook_species_checklist_delete_row = [];
var handleSelectedTaxon;
var taxonNameBeforeUserEdit;
var returnPressedInAutocomplete;
var resetSpeciesTextOnEscape;

(function ($) {
  'use strict';

  var resetSpeciesText;

  function showExistingSubsamplesOnMap() {
    var samples;
    var parser;
    var feature;
    if ($('#existingSampleGeomsBySref').length) {
      parser = new OpenLayers.Format.WKT();
      samples = JSON.parse($('#existingSampleGeomsBySref').val());
      $.each($('.scSpatialRef:not([value=""])'), function () {
        feature = parser.read(samples[$(this).val().toUpperCase()]);
        feature.attributes.type = 'subsample-' + this.id;
        indiciaData.mapdiv.map.editLayer.addFeatures([feature]);
      });
    }
  }

  $(document).ready(function () {
    // prevent validation of the clonable row
    $('.scClonableRow :input').addClass('inactive');
    if ($('#existingSampleGeomsBySref')) {
      mapInitialisationHooks.push(showExistingSubsamplesOnMap);
    }

    if (indiciaData.loadExistingDynamicAttrs) {
      $.each($('table.species-grid'), function() {
        var gridId = this.id;
        var rows = [];
        var taxaTaxonListIds = [];
        var occurrenceIds = [];
        $.each($('table.species-grid tbody tr'), function() {
          var scCtrl = $(this).find('.scPresence[name]');
          if (!indiciaData['limitDynamicAttrsTaxonGroupIds-' + gridId] ||
              $.inArray(parseInt($(this).find('.scTaxonGroupId').val()), indiciaData['limitDynamicAttrsTaxonGroupIds-' + gridId]) !== -1) {
            rows.push(this);
            taxaTaxonListIds.push($(this).find('.scTaxaTaxonListId').val());
            occurrenceIds.push(scCtrl[0].name.match(/species-grid-\d+-\d+:([a-z0-9\-]+)/)[1]);
          }
        });
        loadDynamicAttrs(gridId, taxaTaxonListIds, rows, occurrenceIds);
      });
    }
  });

  /*
   * A keyboard event handler for the grid.
   */
  keyHandler = function (evt) {
    var rows;
    var row;
    var rowIndex;
    var cells;
    var cell;
    var cellIndex;
    var ctrl = this;
    var deltaX = 0;
    var deltaY = 0;
    var isTextbox = this.nodeName.toLowerCase() === 'input' && $(this).attr('type') === 'text';
    var isSelect = this.nodeName.toLowerCase() === 'select';
    var newInput;
    var $newInput;
    var selStart;
    var selLength;
    var selEnd;
    var inputRange;
    if ((evt.keyCode >= 37 && evt.keyCode <= 40) || evt.keyCode === 9) {
      rows = $(this).parents('tbody').children();
      row = $(this).parents('tr')[0];
      rowIndex = rows.index(row);
      cells = $(this).parents('tr').children();
      cell = $(this).parents('td')[0];
      cellIndex = cells.index(cell);
      if (isTextbox) {
        // Determine the current caret/selection position.
        if (typeof this.selectionStart !== 'undefined') {
          selStart = this.selectionStart;
          selEnd = this.selectionEnd;
          selLength = selEnd - selStart;
        } else {
          // Internet Explorer before version 9
          inputRange = document.selection.createRange().duplicate();
          selLength = inputRange.text.length;
          // Move selection start to 0 position
          inputRange.moveStart('character', -this.value.length);
          // The end position is now the lenght of the range.
          selEnd = inputRange.text.length;
          selStart = selEnd - selLength;
        }
      }
    }
    switch (evt.keyCode) {
      case 9:
        // tab direction depends on shift key and occurs irrespective of caret
        deltaX = evt.shiftKey ? -1 : 1;
        break;
      case 37:
        // left. Caret must be at left of text with nothing selected
        if (!isTextbox || (selStart === 0 && selLength === 0)) {
          deltaX = -1;
        }
        break;
      case 38:
        // up. Doesn't work in select as this changes the value
        if (!isSelect && rowIndex > 0) {
          deltaY = -1;
        }
        break;
      case 39:
        // right. Caret must be at right of text
        if (!isTextbox || selStart >= this.value.length ) {
          deltaX = 1;
        }
        break;
      case 40:
        // down. Doesn't work in select as this changes the value
        if (!isSelect && rowIndex < rows.length-1) {
          deltaY = 1;
        }
        break;
    }
    /*
     When the user moves around the grid we need to call the function that copies data into a new row
     from the previous row if that option is set to be used on the edit tab.
     $(this).closest('table').attr('id') gets the gridId for use in the option check.
     */
    if (indiciaData['copyDataFromPreviousRow-' + $(this).closest('table').attr('id')]) {
      if (deltaX + deltaY !== 0) {
        changeIn2ndToLastRow(this);
      }
    }
    if (deltaX !== 0) {
      var inputs = $(this).closest('table').find(':input:visible');
      // timeout necessary to allow keyup to occur on correct control
      setTimeout(function () {
        $newInput = inputs.eq(inputs.index(ctrl) + deltaX);
        if ($newInput.length > 0) {
          // If we have not reached the end of the table
          newInput = $newInput[0];
          // If we have move to a new input which is a text box, select contents so it
          // can be overwritten.
          isTextbox = newInput.nodeName.toLowerCase() === 'input' && $newInput.attr('type') === 'text'
          if (isTextbox) {
            if (typeof newInput.selectionStart !== 'undefined') {
              newInput.selectionStart = 0;
              newInput.selectionEnd = newInput.value.length;
            } else {
              // Internet Explorer before version 9
              inputRange = newInput.createTextRange();
              // Move start of range to beginning of input
              inputRange.moveStart('character', -newInput.value.length);
              // Move end of range to end of input
              inputRange.moveEnd('character', newInput.value.length);
              inputRange.select();
            }
          }
          $newInput.focus();
        }
      }, 200);
      evt.preventDefault();
      // see https://bugzilla.mozilla.org/show_bug.cgi?id=291082 - preventDefault bust in FF
      // so reset the value as arrow keys change the value
      if (isSelect) {
        var select = this, val = $(this).val();
        setTimeout(function () {
          $(select).val(val);
        });
      }
      return false;
    }
    if (deltaY !== 0) {
      $(rows[rowIndex + deltaY]).find('td[headers=' + $(cell).attr('headers') + '] input').focus();
    }
  };

  /**
   * Function to get settings to setup for a species autocomplete.
   */
  function getAutocompleteSettings(extraParams, gridId) {
    var autocompleterSettingsToReturn = {
      extraParams: extraParams,
      continueOnBlur: true,
      max: indiciaData.speciesGrid[gridId].numValues,
      selectMode: indiciaData.speciesGrid[gridId].selectMode,
      matchContains: indiciaData.speciesGrid[gridId].matchContains,
      parse: function resultsParse(data) {
        var results = [];
        var done = {};
        var checkUnique;
        var taxon;
        jQuery.each(data, function taxonParse(i, item) {
          if (typeof indiciaData.hiddenTaxonNames !== 'undefined'
              && jQuery.inArray(item.taxon.toLowerCase(), indiciaData.hiddenTaxonNames) > -1) {
            // Skip name.
            return true;
          }
          // note we track the distinct meaning id and display term, so we don't output duplicates
          // display field does not seem to be available, though there may be some form somewhere which uses it.
          taxon = typeof indiciaFns.uniqueTaxonSimplify === 'undefined' ?
            item.taxon.replace(/\W+/g, '').toLowerCase() : indiciaFns.uniqueTaxonSimplify(item.taxon);
          checkUnique = item.taxon_meaning_id + '_' + taxon;
          if (!done.hasOwnProperty(checkUnique)) {
            results[results.length] = {
              data: item,
              result: item.searchterm,
              value: item.taxa_taxon_list_id
            };
            done[checkUnique] = true;
          }
          return true;
        });
        return results;
      },
      formatItem: formatter
    };
    return autocompleterSettingsToReturn;
  }

  function enableAutocomplete(selector, lookupListId) {
    var ctrl;
    var extraParams = {
      mode: 'json',
      qfield: 'searchQuery',
      auth_token: indiciaData.read.auth_token,
      nonce: indiciaData.read.nonce,
      taxon_list_id: lookupListId
    };
    var autocompleteSettings;
    var gridId = $(selector).closest('table').attr('id');
    if (typeof indiciaData['taxonExtraParams-' + gridId] !== 'undefined') {
      $.extend(extraParams, indiciaData['taxonExtraParams-' + gridId]);
      // a custom query on the list id overrides the standard filter..
      if (typeof extraParams.query !== 'undefined' && extraParams.query.indexOf('taxon_list_id') !== -1) {
        delete extraParams.taxon_list_id;
      }
    }
    autocompleteSettings = getAutocompleteSettings(extraParams, gridId);
    if ($(selector).width() < 200) {
      autocompleteSettings.width = 200;
    }
    ctrl = $(selector).autocomplete(indiciaData.read.url + '/index.php/services/data/taxa_search', autocompleteSettings);
    ctrl.bind('result', handleSelectedTaxon);
    ctrl.bind('return', returnPressedInAutocomplete);
    return ctrl;
  }

  // Create an inner function for adding blank rows to the bottom of the grid
  var makeSpareRow = function(gridId, readAuth, lookupListId, url, evt, scroll, keycode, force) {

    /**
     * Function fired when return pressed in the species selector - adds a new row and focuses it. Must be enclosed so that
     * it can refer to things like the gridId if there are multiple grids.
     */
    returnPressedInAutocomplete = function (e) {
      var rows = $(e.currentTarget).parents('tbody').children();
      var rowIndex = rows.index($(e.currentTarget).parents('tr')[0]);
      if (rowIndex === rows.length - 1) {
        var ctrl = makeSpareRow(gridId, readAuth, lookupListId, url, null, true, 13, true);
        // is return key pressed, if so focus next row
        setTimeout(function () { $(ctrl).focus(); });
      } else {
        // focus the next row
        $(rows[rowIndex + 1]).find('td.scTaxonCell input').focus();
        e.preventDefault();
      }
    };

    handleSelectedTaxon = function (e, data, value) {
      var taxonCell;
      var checkbox;
      var rowId;
      var row;
      var label;
      var subSpeciesCellIdBeginsWith;
      var regex;
      var deleteAndEditHtml;
      if (!data) {
        return false;
      }
      /*
       As soon as the user selects a species, we need to save its id as otherwise the information is lost. This is used
       if the user selects a sub-species, but then selects the blank option again, we can then use the main species id.
       */
      mainSpeciesValue = value;
      // on picking a result in the autocomplete, ensure we have a spare row
      // clear the event handlers
      $(e.target).unbind('result', handleSelectedTaxon);
      $(e.target).unbind('return', returnPressedInAutocomplete);
      taxonCell = e.target.parentNode;
      /* Create edit icons for taxon cells. Only add the edit icon if the user has this functionality available on the
      edit tab. Also create Notes and Delete icons when required */
      var linkPageIconSource = indiciaData.imagesPath + 'nuvola/find-22px.png';
      if (indiciaData['editTaxaNames-' + gridId]) {
        deleteAndEditHtml = "<td class='row-buttons'>\n\
            <img class='action-button remove-row' src=" + indiciaData.imagesPath + "nuvola/cancel-16px.png>\n"
        deleteAndEditHtml += "<img class='action-button edit-taxon-name' src=" + indiciaData.imagesPath + "nuvola/package_editors-16px.png>\n";
        if (indiciaData['includeSpeciesGridLinkPage-' + gridId]) {
          deleteAndEditHtml += '<img class="species-grid-link-page-icon" title="'+indiciaData.speciesGridPageLinkTooltip+'" alt="Notes icon" src=' + linkPageIconSource + '>';
        }
        deleteAndEditHtml += '</td>';
      } else {
        deleteAndEditHtml = "<td class='row-buttons'>\n\
            <img class='action-button action-button remove-row' src=" + indiciaData.imagesPath + 'nuvola/cancel-16px.png>\n';
        if (indiciaData['includeSpeciesGridLinkPage-' + gridId]) {
          deleteAndEditHtml += '<img class="species-grid-link-page-icon" title="' + indiciaData.speciesGridPageLinkTooltip+'" alt="Notes icon" src=' + linkPageIconSource + '>';
        }
        deleteAndEditHtml += '</td>';
      }
      // Put the edit and delete icons just before the taxon name
      $(taxonCell).before(deleteAndEditHtml);
      // Note case must be colSpan to work in IE!
      $(taxonCell).attr('colSpan', 1);
      row = taxonCell.parentNode;
      // Only add this class if the user is adding new taxa, if they are editing existing taxa we don't add the class so
      // that when the delete icon is used the row becomes greyed out instead of deleted.
      if ($(row).hasClass('scClonableRow')) {
        $(taxonCell).parent().addClass('added-row');
      }
      $(taxonCell).parent().removeClass('scClonableRow');
      $(taxonCell).parent().find('input,select,textarea').removeClass('inactive');
      // Do we use a JavaScript fn, or a standard template, to format the species label?
      if ($.isFunction(formatter)) {
        $(taxonCell).html(formatter(data));
      } else {
        // Just a simple PHP template
        label = formatter;
        // replace each field in the label template
        $.each(data, function (field, val) {
          regex = new RegExp('\\{' + field + '\\}', 'g');
          label = label.replace(regex, val === null ? '' : val);
        });
        $(taxonCell).html(label);
      }
      $(row).find('.id-diff').hover(indiciaFns.hoverIdDiffIcon);
      $(row).find('.species-checklist-select-species').hide();
      $(row).find('.add-media-link').show();
      // auto-check the row
      checkbox = $(row).find('.scPresenceCell input.scPresence').last();
      checkbox.attr('checked', 'checked');
      // store the ttlId and other taxonomic info.
      checkbox.val(data.taxa_taxon_list_id);
      $(row).find('.scPresenceCell .scTaxaTaxonListId').val(data.taxa_taxon_list_id);
      $(row).find('.scPresenceCell .scTaxonGroupId').val(data.taxon_group_id);
      if (indiciaData['subSpeciesColumn-' + gridId]) {
        // Setup a subspecies picker if this option is enabled. Since we don't know for sure if this is matching the
        // last row in the grid (as the user might be typing ahead), use the presence checkbox to extract the row unique ID.
        rowId = checkbox[0].id.match(/sc:([a-z0-9\-]+)/)[1];
        subSpeciesCellIdBeginsWith = 'sc:' + rowId + ':';
        createSubSpeciesList(url, data.preferred_taxa_taxon_list_id, data.preferred_taxon, lookupListId, subSpeciesCellIdBeginsWith, readAuth, 0);
      }
      if (indiciaData['enableDynamicAttrs-' + gridId]) {
        if (!indiciaData['limitDynamicAttrsTaxonGroupIds-' + gridId] ||
            $.inArray(parseInt(data.taxon_group_id), indiciaData['limitDynamicAttrsTaxonGroupIds-' + gridId]) !== -1) {
          loadDynamicAttrs(gridId, [data.taxa_taxon_list_id], [$(row)]);
        } else {
          $(row).find('.hidden-by-dynamic-attr')
            .removeClass('hidden-by-dynamic-attr')
            .prop('disabled', false);
          $(row).find('.dynamic-attr').remove();
        }
      }
      // Finally, a blank row is added for the next record
      makeSpareRow(gridId, readAuth, lookupListId, url, null, true);
      // When user selects a taxon then the new row is created, we want to copy data into that new row from previous row
      // automatically. when the option to do so is set.
      if (indiciaData['copyDataFromPreviousRow-' + gridId]) {
        species_checklist_add_another_row(gridId);
      }
      // Allow forms to hook into the event of a new row being added
      $.each(hook_species_checklist_new_row, function (idx, fn) {
        fn(data, row);
      });
    };
    // If the user chooses to edit a species on the grid, then immediately 'clicks off'
    // the cell, then we have code that puts the label back to the way it was
    resetSpeciesText = function(event) {
      var row;
      var deleteAndEditHtml;
      var taxonCell;
      var gridId;
      var selectorId;
      var linkPageIconSource;
      // Only do reset if the autocomplete drop down isn't showing, else we assume the user is still working with
      // the cell
      if ($('.ac_over').length === 0) {
        row = $($(event.target).parents('tr:first'));
        taxonCell = $(row).children('.scTaxonCell');
        gridId = $(taxonCell).closest('table').attr('id');
        selectorId = gridId + '-' + indiciaData['gridCounter-' + gridId];
        // remove the current contents of the taxon cell
        $('#' + selectorId).remove();
        // replace with the previous plain text species name
        $(taxonCell).html(taxonNameBeforeUserEdit);
        deleteAndEditHtml = '<td class="row-buttons">\n' +
            '<img class="action-button remove-row" src="' + indiciaData.imagesPath + 'nuvola/cancel-16px.png">\n' +
            '<img class="edit-taxon-name" src="' + indiciaData.imagesPath + 'nuvola/package_editors-16px.png">\n';
        if (indiciaData['includeSpeciesGridLinkPage-' + gridId]) {
          linkPageIconSource = indiciaData.imagesPath + 'nuvola/find-22px.png';
          deleteAndEditHtml += '<img class="species-grid-link-page-icon" title="' +
            indiciaData.speciesGridPageLinkTooltip + '" alt="Notes icon" src=' + linkPageIconSource + '>\n';
        }
        deleteAndEditHtml += '</td>\n';
        $(taxonCell).attr('colSpan', 1);
        // Put the edit and delete icons just before the taxon name
        $(taxonCell).before(deleteAndEditHtml);
      }
    }
    // If the user presses escape after choosing to edit a taxon name then set it back to a read-only label
    resetSpeciesTextOnEscape = function (event) {
      if (event.which === 27) {
        resetSpeciesText(event);
      }
    }

    if (typeof formatter === 'undefined' || !$.isFunction(formatter)) {
      // provide a default format function
      formatter = function (item) {
        return item.taxon;
      };
    }
    // only add a spare row if none already exist, or forced to do so
    if ($('table#' + gridId + ' tr.scClonableRow').length >= 1 && !force) {
      return;
    }
    // get a copy of the new row template
    var extraParams, newRow = $('tr#'+gridId + '-scClonableRow').clone(true), selectorId, speciesSelector,
        attrVal, ctrl;
    // build an auto-complete control for selecting the species to add to the bottom of the grid.
    // The next line gets a unique id for the autocomplete.
    selectorId = gridId + '-' + indiciaData['gridCounter-'+gridId];
    speciesSelector = '<input type="text" id="' + selectorId + '" class="grid-required {speciesMustBeFilled:true}" />';
    // put this inside the new row template in place of the species label.
    $(newRow).html($(newRow.html().replace('{content}', speciesSelector)));
    // Replace the tags in the row template with a unique row ID
    $.each($(newRow).children(), function(i, cell) {
      $.each($(cell).find('*'), function(idx, child) {
        attrVal = $(child).attr('name');
        if (typeof attrVal !== 'undefined' && attrVal.indexOf('-idx-') !== -1) {
          $(child).attr('name', $(child).attr('name').replace(/-idx-/g, indiciaData['gridCounter-'+gridId]));
        }
        attrVal = $(child).attr('id');
        if (typeof attrVal !== 'undefined' && attrVal.indexOf('-idx-') !== -1) {
          $(child).attr('id', $(child).attr('id').replace(/-idx-/g, indiciaData['gridCounter-'+gridId]));
        }
        attrVal = $(child).attr('for');
        if (typeof attrVal !== 'undefined' && attrVal.indexOf('-idx-') !== -1) {
          $(child).attr('for', $(child).attr('for').replace(/-idx-/g, indiciaData['gridCounter-' + gridId]));
        }
      });
    });
    $(newRow).find("[name$='\:sampleIDX']").each(function(idx, field) {
      if (indiciaData['subSamplePerRow-' + gridId]) {
        // Allows a sample to be generated for each occurrence in the grid if required.
        var rowNumber = $(field).attr('name').replace('sc:' + gridId + '-', '');
        rowNumber = rowNumber.substring(0, 1);
        $(field).val(rowNumber);
      } else {
        $(field).val(typeof indiciaData.control_speciesmap_existing_feature === 'undefined' || indiciaData.control_speciesmap_existing_feature===null ?
            indiciaData['gridSampleCounter-' + gridId] : indiciaData.control_speciesmap_existing_feature.attributes.subSampleIndex);
      }
    });
    // add the row to the bottom of the grid
    newRow.appendTo('table#' + gridId + ' > tbody').removeAttr('id');
    ctrl = enableAutocomplete('#' + selectorId, lookupListId);
    $(newRow).find('input,select').keydown(keyHandler);
    // Check that the new entry control for taxa will remain in view with enough space for the autocomplete drop down
    if (scroll && ctrl.offset().top > $(window).scrollTop() + $(window).height() - 180) {
      var newTop = ctrl.offset().top - $(window).height() + 180;
      // slide the body upwards so the grid entry box remains in view, as does the drop down content on the autocomplete for taxa
      $('html,body').animate({ scrollTop: newTop }, 500);
    }
    // increment the count so it is unique next time and we can generate unique IDs
    indiciaData['gridCounter-' + gridId]++;
    return ctrl;
  };

  addRowToGrid = function (url, gridId, lookupListId, readAuth, formatter) {
    makeSpareRow(gridId, readAuth, lookupListId, url, null, false);
    // Deal with user clicking on edit taxon icon
    indiciaFns.on('click', '.edit-taxon-name', {}, function (e) {
      var row = $($(e.target).parents('tr:first'));
      var taxonCell = $(row).children('.scTaxonCell');
      var subspSelect = $(row).find('.scSubSpecies');
      var selectorId = gridId + '-' + indiciaData['gridCounter-' + gridId];
      var taxonTextBeforeUserEdit;
      // When moving into edit mode we need to create an autocomplete box for the user to fill in
      var speciesAutocomplete = '<input type="text" id="' + selectorId + '" class="grid-required ac_input {speciesMustBeFilled:true}" />';
      var ctrl;
      if ($('.ac_results:visible').length > 0 || !$(e.target).is(':visible')) {
        // Don't go into edit mode if they are picking a species name already.
        return;
      }
      // Remove the edit and delete icons.
      $(e.target).parent().remove();
      taxonNameBeforeUserEdit = $(taxonCell).html();
      // first span should contain the name as it was entered
      taxonTextBeforeUserEdit = $(taxonCell).find('.taxon-name').text();
      // Adjust the size of the taxon cell to take up its full allocation of space
      $(taxonCell).attr('colSpan', 2);
      // If we have a subspecies select, enable it
      if (subspSelect.length > 0) {
        $(subspSelect).removeAttr('disabled');
      }
      // Moving into edit mode, we need to clear the static taxon label otherwise
      // the name is shown twice (it is also shown in the autocomplete)
      $(taxonCell).text('');
      // Add the autocomplete cell
      $(taxonCell).append(speciesAutocomplete);
      ctrl = enableAutocomplete($(taxonCell).children(':input'), lookupListId);
      // Put the taxon name into the autocomplete ready for editing
      $('#' + selectorId).val(taxonTextBeforeUserEdit);
      $('#' + selectorId).focus();
      // Set the focus to the end of the string, this isn't elegant, but seems to be quickest way to do this.
      // After we set focus, we add a space to the end of the string to force focus to end, then remove the space
      $('#' + selectorId).val($('#' + selectorId).val() + ' ');
      $('#' + selectorId).val($('#' + selectorId).val().slice(0, -1));
      // Bind function so that when user loses focus on the taxon cell immediately after clicking edit, we can reset
      // the cell back to read-only label
      //ctrl.bind('blur', resetSpeciesText);
      ctrl.bind('keydown', resetSpeciesTextOnEscape);
    });
  };

  indiciaFns.on('click', '.remove-row', {}, function (e) {
    var table = $(e.currentTarget).closest('table.species-grid');
    var row = $(e.currentTarget).closest('tr');
    var proceed = true;
    e.preventDefault();
    // Allow forms to hook into the event of a row being deleted, most likely use would be to have a confirmation dialog
    $.each(window.hook_species_checklist_pre_delete_row, function (idx, fn) {
      proceed = proceed && fn(e, table, row);
    });
    if (!proceed) {
      return;
    }

    if (row.next().find('.file-box').length > 0) {
      // remove the uploader row
      row.next().remove();
    }
    if (row.hasClass('added-row')) {
      row.remove();
    } else {
      // This was a pre-existing occurrence so we can't just delete the row from the grid. Grey it out
      row.css('opacity', 0.25);
      // Use the presence checkbox to remove the taxon, even if the checkbox is hidden.
      row.find('.scPresence').attr('checked', false);
      // Hide the checkbox so this can't be undone
      row.find('.scPresence').css('display', 'none');
      // disable or remove all other active controls from the row.
      // Do NOT disable the presence checkbox or the container td, nor the sample Index field if present, otherwise they are not submitted.
      row.find('*:not(.scPresence,.scPresenceCell,.scSample,.scSampleCell)').attr('disabled','disabled');
      row.find('a').remove();
    }
    // Allow forms to hook into the event of a row being deleted
    $.each(window.hook_species_checklist_delete_row, function (idx, fn) {
      fn(e, table);
    });
  });

  // Open the specified page when the user clicks on the page link icon on a species grid row, use a dirty URL as this will work whether clean urls is on or not
  indiciaFns.on('click', '.species-grid-link-page-icon', {}, function(e) {
    var row = $($(e.target).parents('tr:first'));
    var taxa_taxon_list_id_to_use;
    //We cannot get the taxa_taxon_list_id by simply just getting the presence cell value, as sometimes there is more than one
    //presence cell. This is because there is an extra presence cell that is used to supply a 0 in the $_GET to the submission
    //as a checkbox input type doesn't appear in the $_GET with a 0 value.
    //So we need to actually use the presence cell with a non-zero value.
    row.find('.scPresence').each( function() {
      if ($(this).val()!=0) {
        taxa_taxon_list_id_to_use=$(this).val();
      }
    });
    window.open(indiciaData.rootFolder + '?q=' + indiciaData.speciesGridPageLinkUrl + '&' + indiciaData.speciesGridPageLinkParameter + '=' +  taxa_taxon_list_id_to_use)
  });

  /**
   * Click handler for the add image link that is displayed alongside each occurrence row in the grid once
   * it has been linked to a taxon. Adds a row to the grid specifically to contain a file uploader for images
   * linked to that occurrence.
   */
  indiciaFns.on('click', '.add-media-link', {}, function onClick(evt) {
    var table = evt.target.id.replace('add-media', 'sc') + ':occurrence_medium';
    var ctrlId = 'container-' + table + '-' + Math.floor((Math.random()) * 0x10000);
    var colspan = $($(evt.target).parent().parent()).children().length;
    var imageRow = '<tr class="image-row"><td colspan="' + colspan + '">';
    var mediaTypes = indiciaData.uploadSettings.mediaTypes;
    var settingsToClone = [
      'uploadScript', 'destinationFolder', 'relativeImageFolder',
      'resizeWidth', 'resizeHeight', 'resizeQuality',
      'caption', 'addBtnCaption', 'msgPhoto', 'msgFile',
      'msgLink', 'msgNewImage', 'msgDelete'
    ];
    evt.preventDefault();
    imageRow += '<div class="file-box" id="' + ctrlId + '"></div>';
    imageRow += '</td></tr>';
    imageRow = $(imageRow);
    $($(evt.target).parent().parent()).after(imageRow);
    var opts = {
      caption: (mediaTypes.length === 1 && mediaTypes[0] === 'Image:Local') ? 'Photos' : 'Files',
      autoupload: '1',
      msgUploadError: 'An error occurred uploading the file.',
      msgFileTooBig: 'The image file cannot be uploaded because it is larger than the maximum file size allowed.',
      runtimes: 'html5,flash,silverlight,html4',
      imagewidth: '250',
      jsPath: indiciaData.uploadSettings.jsPath,
      table: table,
      maxUploadSize: '4000000', // 4mb
      container: ctrlId,
      autopick: true,
      mediaTypes: mediaTypes
    };
    // Copy settings from indiciaData.uploadSettings
    $.each(settingsToClone, function() {
      if (typeof indiciaData.uploadSettings[this]!=='undefined') {
        opts[this]=indiciaData.uploadSettings[this];
      }
    });
    if (typeof buttonTemplate!=='undefined') { opts.buttonTemplate=buttonTemplate; }
    if (typeof file_boxTemplate!=='undefined') { opts.file_boxTemplate=file_boxTemplate; }
    if (typeof file_box_initial_file_infoTemplate!=='undefined') { opts.file_box_initial_file_infoTemplate=file_box_initial_file_infoTemplate; }
    if (typeof file_box_uploaded_imageTemplate!=='undefined') { opts.file_box_uploaded_imageTemplate=file_box_uploaded_imageTemplate; }
    imageRow.find('div').uploader(opts);
    $(evt.target).hide();
  });

  indiciaFns.on('click', '.hide-image-link', {}, function (evt) {
    var ctrlId = (evt.target.id.replace(/^hide\-images/, 'container-sc') + ':occurrence_medium').replace(/:/g, '\\:');
    evt.preventDefault();
    if ($(evt.target).hasClass('images-hidden')) {
      $('#' + ctrlId).show();
      $(evt.target).removeClass('images-hidden');
      $(evt.target).html('hide images');
    } else {
      $('#' + ctrlId).hide();
      $(evt.target).addClass('images-hidden');
      $(evt.target).html('show images');
    }
  });

  /**
   * Method to assist with converting a control in the grid into a popup link. Example usage:
   * jQuery(document).ready(function() {
   *   ConvertControlsToPopup($('.scComment'), 'Comment', indiciaData.imagesPath + 'nuvola/package_editors-22px.png');
   * });
   *
   * function hook_species_checklist_new_row(data) {
   *   var id='#sc:'+data.taxa_taxon_list_id+'::occurrence:comment';
   *   id = id.replace(/:/g, '\\:');
   *   ConvertControlsToPopup($(id), 'Comment', indiciaData.imagesPath + 'nuvola/package_editors-22px.png');
   * }
  */
  ConvertControlsToPopup = function (controls, label, icon) {
    var identifier;
    $.each(controls, function (i, input) {
      if ($(input).parents('.scClonableRow').length === 0) {
        // make a unique id for the item which is jQuery safe.
        identifier = input.id.replace(/:/g, '-');
        $(input).after('<div style="display: none;" id="hide-' + identifier + '"><div id="anchor-' + identifier + '"></div></div>');
        $(input).after('<a href="#anchor-' + identifier + '" id="click-' + identifier + '">' +
            '<img src="' + icon + '" width="22" height="22" alt="Show ' + label + '" /></a>');
        $('#anchor-' + identifier).append('<label>' + label + ':</label><br/>');
        $('#anchor-' + identifier).append(input);
        $('#anchor-' + identifier).append('<br/><input type="button" value="Close" onclick="jQuery.fancybox.close();" class="ui-state-default ui-corner-all" />');
        // make sure the input shows, though at this stage it is in a hidden div. @todo This is a bit of a nasty hack,
        // would rather obay CSS precedence rules but !important is getting in the way.
        $(input).css('cssText', 'display: inline !important');
        $('#click-' + identifier).fancybox({ helpers: { title: null }, closeBtn: false });
      }
    });
  };

  RegExp.escape = function (s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  };

  /* Validators for spatial reference column in the species checklist grid */
  indiciaFns.on('change', '#imp-geom', {}, function () {
    var clickPoint;
    // only if we have a spatial reference subcolumn do we need do do anything
    if ($('.scSpatialRef').length > 0 && $('#review-input').length > 0) {
      $('.review-value-spatialref').removeClass('warning').attr('title', '');
      $('.scSpatialRef').removeClass('warning').attr('title', '');
      $.each(indiciaData.mapdiv.map.editLayer.features, function () {
        if (this.attributes.type === 'clickPoint') {
          clickPoint = this;
          return false;
        }
        return true;
      });
      $.each(indiciaData.mapdiv.map.editLayer.features, function () {
        var ctrlId;
        var reviewControl;
        if (this.attributes.type.match('subsample-')) {
          if (!this.geometry.intersects(clickPoint.geometry)) {
            ctrlId = this.attributes.type.replace(/^subsample-/, '').replace(/:/g, '\\:');
            reviewControl = $('#review-' + ctrlId);
            if (reviewControl.length) {
              $(reviewControl).addClass('warning');
              $(reviewControl).attr('title', 'Outside the boundary of the main grid square');
            }
            $('#' + ctrlId).addClass('warning');
            $('#' + ctrlId).attr('title', 'Outside the boundary of the main grid square');
          }
        }
      });
    }
  });

  /**
   * Determines if the current sref system is a grid system as opposed to a point based (lat long or x,y) system.
   */
  function usingGridSystem() {
    var currentSystem = $('#' + indiciaData.mapdiv.settings.srefSystemId).val();
    // Numeric systems are EPSG codes, so points rather than grids.
    return !currentSystem.match(/^\d+$/);
  }

  /**
   * When a finer grid ref control value is changed, determine if the associated precision control should be enabled
   * or disabled.
   *
   * @param object srefControl
   * @param string system
   */
  function setupSrefPrecisionControl(srefControl, system) {
    var finerSref = $(srefControl).val().trim();
    var finerSrefIsPointSystem = system.match(/^\d+$/);
    var finerSrefIsPrecise = finerSrefIsPointSystem || finerSref.match(/[\d]/g).length >= 9;
    var precisionCtrl = $(srefControl).closest('tr').find('.scSpatialRefPrecision');
    if (precisionCtrl.length === 0) {
      precisionCtrl = $(srefControl).closest('tr').next('tr.footable-row-detail').find('.scSpatialRefPrecision');
    }
    if (precisionCtrl.length > 0) {
      if (finerSrefIsPrecise) {
        precisionCtrl.removeAttr('disabled');
        precisionCtrl.removeAttr('placeholder');
      } else {
        precisionCtrl.attr('disabled', 'disabled');
        precisionCtrl.attr('placeholder', 'n/a');
        precisionCtrl.val('');
      }
    }
  }

  indiciaFns.on('change', '.scSpatialRef', {}, function (e) {
    var parser;
    var feature;
    var system = $('#' + indiciaData.mapdiv.settings.srefSystemId).val();
    indiciaData.mapdiv.removeAllFeatures(indiciaData.mapdiv.map.editLayer, 'subsample-' + e.currentTarget.id);
    // If in a grid system and provided ref matches 4326 format, assume 4326.
    if (usingGridSystem() && $(e.currentTarget).val().match(/^[+-]?[0-9]*(\.[0-9]*)?[NS]?,?\s+[+-]?[0-9]*(\.[0-9]*)?[EW]?$/)) {
      system = '4326';
    }
    setupSrefPrecisionControl(this, system);
    $.ajax({
      dataType: 'jsonp',
      url: indiciaData.warehouseUrl + 'index.php/services/spatial/sref_to_wkt',
      data: 'sref=' + $(e.currentTarget).val() +
        '&system=' + system +
        '&mapsystem=' + indiciaFns.projectionToSystem(indiciaData.mapdiv.map.projection, false),
      success: function (data) {
        if (typeof data.error !== 'undefined') {
          if (data.code === 4001) {
            alert(indiciaData.mapdiv.settings.msgSrefNotRecognised);
          } else {
            alert(data.error);
          }
          $(e.currentTarget).addClass('ui-state-error');
        } else {
          $(e.currentTarget).removeClass('ui-state-error');
          $(e.currentTarget).removeClass('warning');
          parser = new OpenLayers.Format.WKT();
          feature = parser.read(data.mapwkt);
          feature.attributes.type = 'subsample-' + e.currentTarget.id;
          $(e.currentTarget).attr('title', '');
          if ($('#review-input').length > 0) {
            $.each(indiciaData.mapdiv.map.editLayer.features, function () {
              var reviewControl;
              if (this.attributes.type === 'clickPoint' && !this.geometry.intersects(feature.geometry)) {
                $(e.currentTarget).addClass('warning');
                $(e.currentTarget).attr('title', 'Outside the boundary of the main grid square');
                // Show warning icon on the review_input control if present.
                reviewControl = $('#review-' + e.currentTarget.id.replace(/:/g, '\\:'));
                if (reviewControl.length) {
                  $(reviewControl).addClass('warning');
                  $(reviewControl).attr('title', 'Outside the boundary of the main grid square');
                }
              }
            });
          }
          indiciaData.mapdiv.map.editLayer.addFeatures([feature]);
        }
      }
    });
  });

  /**
   * Prevents non-numeric input in sref precision column inputs.
   */
  indiciaFns.on('keydown', '.scSpatialRefPrecision', {}, function (e) {
    // Allow: backspace, delete, tab, escape, enter and .
    if ($.inArray(e.keyCode, [46, 8, 9, 27, 13, 110, 190]) !== -1 ||
        // Allow: Ctrl+A, Command+A
        (e.keyCode === 65 && (e.ctrlKey === true || e.metaKey === true)) ||
        // Allow: home, end, left, right, down, up
        (e.keyCode >= 35 && e.keyCode <= 40)) {
      // let it happen, don't do anything
      return;
    }
    // Ensure that it is a number and stop the keypress
    if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
      e.preventDefault();
    }
  });

  function loadDynamicAttrs(gridId, taxaTaxonListIds, rows, occurrenceIds) {
    var urlSep = indiciaData.dynamicAttrProxyUrl.indexOf('?') === -1 ? '?' : '&';
    occurrenceIds = occurrenceIds ? occurrenceIds : '0';
    // Find available dynamic attributes for the selected species.
    $.get(indiciaData.dynamicAttrProxyUrl + '/getSpeciesChecklistAttrs' + urlSep +
        'survey_id=' + $('#survey_id').val() +
        '&taxa_taxon_list_ids=' + taxaTaxonListIds +
        '&occurrence_id=' + occurrenceIds +
        '&type=occurrence' +
        '&language=' + indiciaData.userLang +
        // @todo: Otions may need to be passed through for individual attr controls.
        '&options={}', null,
      function getAttrsReportCallback(data) {
        $.each(rows, function() {
          var row = this;
          // Capture all current attrs values for each row so they can be placed into new controls.
          $.each($(row).find('td.scOccAttrCell'), function() {
            var theInput = $(this).find(':input').not(':disabled');
            if ($(theInput).is('select')) {
              $(this).attr('data-oldval', $(theInput).text().trim());
            } else if ($(theInput).is('input')) {
              $(this).attr('data-oldval', $(theInput).val().trim());
            } else {
              $(this).removeAttr('data-oldval');
            }
          });
          // If dynamic attrs previously loaded for the row, replace the original
          // inputs before applying the new set (since the new set may not have
          // attrs for the same columns as the old set).
          $(row).find('.hidden-by-dynamic-attr')
            .removeClass('hidden-by-dynamic-attr')
            .prop('disabled', false);
          $(row).find('.dynamic-attr').remove();
        });
        $.each(data, function() {
          var dataRow = this;
          var row = dataRow.attr.occurrence_id
            ? $(rows).find('.scPresence[id$=":' + dataRow.attr.occurrence_id + ':present"]').closest('tr')
            : rows[0];
          var rowPrefix = $(row).find('.scPresence').last().attr('id').match(/(sc:[a-z0-9\-]+)/)[1];
          var attrId = dataRow.attr.attribute_id;
          var systemFunction = dataRow.attr.system_function;
          var ctrl = $(dataRow.control);
          if (systemFunction) {
            ctrl
              .attr('name', rowPrefix + '::occAttr:' + attrId)
              .addClass('system-function-' + systemFunction)
              .addClass('dynamic-attr');
            $.each(indiciaData['dynamicAttrInfo-' + gridId][systemFunction], function(idx) {
              var cell = $(row).find('td.' + this + 'Cell');
              var values;
              // If multiple columns for same sysfuncton, only use the first
              // and empty the rest.
              if (idx === 0) {
                // Remove old dynamic attributes in the cell as well as errors.
                cell.find('dynamic-attr, .inline-error').remove();
                // Hide and disable the non-dynamic attr for this cell, so we don't lose it
                // if the row is edited to a species without dynamic attrs.
                cell.find('*')
                  .addClass('hidden-by-dynamic-attr')
                  .removeClass('ui-state-error')
                  .prop('disabled', true);
                // Tag the control against the column.
                ctrl.addClass(this);
                // Set any existint value into the control.
                if (dataRow.attr.values) {
                  values = JSON.parse(dataRow.attr.values);
                  if (values.length) {
                    ctrl.val(values[0]['raw_value']);
                  }
                }
                if ($(cell).attr('data-oldval')) {
                  if (ctrl.is('select')) {
                    ctrl.find('option').filter(function () {
                      return $(this).html().toLowerCase().trim() === $(cell).attr('data-oldval').toLowerCase();
                    }).prop('selected', true);
                  } else if (ctrl.is('input')) {
                    ctrl.val($(cell).attr('data-oldval'));
                  }
                }
                // Attach existing attrs to the correct occurrence ID.
                if (dataRow.attr.occurrence_id) {
                  ctrl.attr('name', ctrl.attr('name').replace('::', ':' + dataRow.attr.occurrence_id + ':'));
                }
                // Add the new dynamic attr control to the grid cell.
                cell.append(ctrl);
              } else {
                // 2nd or later column for same sysfunction, so hide the control.
                cell.html('');
              }
            });
          }
        });
      },
      'json'
    );
  }

})(jQuery);

function createSubSpeciesList(url, selectedItemPrefId, selectedItemPrefName, lookupListId,
  subSpeciesCtrlIdBeginsWith, readAuth, selectedChild) {
  'use strict';
  var subSpeciesData = {
    mode: 'json',
    nonce: readAuth.nonce,
    auth_token: readAuth.auth_token,
    parent_id: selectedItemPrefId,
    taxon_list_id: lookupListId,
    name_type: 'L',
    simplified: 'f'
  };
  var ctrl = jQuery('[id^=' + subSpeciesCtrlIdBeginsWith.replace(/:/g, '\\:') + '][id$=\\:occurrence\\:subspecies]');
  if (ctrl.length > 0) {
    jQuery.getJSON(url + '/cache_taxon_searchterm?callback=?', subSpeciesData,
      function (data) {
        var sspRegexString;
        var epithet;
        var nameRegex;
        // Clear the sub-species cell ready for new data
        ctrl.empty();
        // Build a regex that can remove the species binomial (plus optionally the subsp rank) from the name, so
        // Adelia decempunctata forma bimaculata can be shown as just bimaculata.
        sspRegexString = RegExp.escape(selectedItemPrefName);
        if (typeof indiciaData.subspeciesRanksToStrip !== 'undefined') {
          sspRegexString += '[ ]+' + indiciaData.subspeciesRanksToStrip;
        }
        nameRegex = new RegExp('^' + sspRegexString);
        // Work our way through the sub-species data returned from data services
        jQuery.each(data, function (i, item) {
          epithet = item.preferred_taxon.replace(nameRegex, '');
          if (selectedChild === item.taxa_taxon_list_id) {
            // If we find the sub-species we want to be selected by default then we set the 'selected' attribute on html the option tag
            ctrl.append(jQuery('<option selected="selected"></option>').val(item.taxa_taxon_list_id).html(epithet));
          } else {
            // If we don't want this sub-species to be selected by default then we don't set the 'selected' attribute on html the option tag
            ctrl.append(jQuery('<option></option>').val(item.taxa_taxon_list_id).html(epithet));
          }
        });
        // If we don't find any sub-species then hide the control
        if (data.length === 0) {
          ctrl.hide();
        } else {
          // The selected sub-species might be the first (blank) option if there are sub-species present but
          // we don't know yet which one the user wants.
          // This would occur if the user manually fills in the species and the parent has sub-species
          if (selectedChild === 0) {
            ctrl.prepend("<option value='' selected='selected'></option>");
          }
          ctrl.show();
        }
      }
    );
  }
}

function SetHtmlIdsOnSubspeciesChange(subSpeciesId) {
  'use strict';
  // We can work out the grid row number we are working with by stripping the sub-species id.
  var presentCellId;
  var presentCellSelector;
  var subSpecieSelectorId;
  var subSpeciesValue;
  var gridRowId = subSpeciesId.replace(/^sc:/, '').match(/^([a-z0-9\-]*)/g);
  presentCellId = 'sc:' + gridRowId + '::present';
  // We need to escape certain characters in the html id so we can use it with jQuery.
  presentCellSelector = presentCellId.replace(/:/g, '\\:');
  // If we don't have a taxon id for the parent species saved, then collect it from the html.
  if (!mainSpeciesValue) {
    mainSpeciesValue = jQuery('#' + presentCellSelector).val();
  }
  subSpecieSelectorId = subSpeciesId.replace(/:/g, '\\:');
  subSpeciesValue = (jQuery('#' + subSpecieSelectorId).val());
  // If the user has selected the blank sub-species row, then we use the parent species.
  if (subSpeciesValue === '') {
    jQuery('#' + presentCellSelector).val(mainSpeciesValue);
  }
  if (subSpeciesValue) {
    jQuery('#' + presentCellSelector).val(subSpeciesValue);
  }
}

//When working with data in individual occurrence attribute columns, we need to get a nice unique clean class for that column
//to work with in selectors we want to use. So we just need to grab the class that starts 'sc'.
function getScClassForColumnCellInput(input) {
  //get the class for the cell
  var classesArray = jQuery(input).attr('class').split(/\s+/);
    //for our purposes we are only interested in the classes beginning sc
  var theInputClass = new Array();
  jQuery.each(classesArray, function(index, value){
    if (value.substr(0,2) === 'sc') {
      theInputClass.push(value);
    }
    });
  if (theInputClass.length > 0) {
    return theInputClass[0];
  }
  else {
    return false;
  }
}

//When the user edits the second last row, then copy the data from the changed cell
//into the new row.
function changeIn2ndToLastRow(input) {
  //get user specified columns to include in the copy
  var gridId = jQuery(input).closest('table').attr('id'),
      columnsToInclude = indiciaData['previousRowColumnsToInclude-'+gridId].split(",");
  //get rid of all of the spacing and capital letters
  for (i=0; i<columnsToInclude.length;i++) {
    columnsToInclude[i] = 'sc'+columnsToInclude[i].replace(/ /g,'').toLowerCase();
  }

  var classToUse = getScClassForColumnCellInput(input),
      $newRow = jQuery('table#'+gridId + ' tr.scClonableRow'),
      //The '.added-row:first' check is there
      //as the user might of added an image-row which we need to ignore
      $previousRow = $newRow.prevAll(".added-row:first");
  //Copy data from the 2nd last row into the new row only if the column
  //is in the user's options
  if (classToUse && (jQuery.inArray(classToUse.toLowerCase(), columnsToInclude)>-1)) {
    $newRow.find('.'+classToUse).val($previousRow.find('.'+classToUse).val());
  }
}

// This proxies the above method so that it can be called from an event with this set to the input, rather
// than directly passing the input as a parameter.
function changeIn2ndToLastRowProxy() {
  changeIn2ndToLastRow(this);
}

//function to copy the values for a new row from the previous row as the new row is added.
function species_checklist_add_another_row(gridId) {
  //get user specified columns to include in the copy
  var columnsToInclude = indiciaData['previousRowColumnsToInclude-'+gridId].split(",");
  //get rid of all of the spacing and capital letters
  for (i=0; i<columnsToInclude.length;i++) {
    columnsToInclude[i] = 'sc'+columnsToInclude[i].replace(/ /g,'').toLowerCase();
  }

  var $newRow = jQuery('table#'+gridId + ' tr.scClonableRow');
  //Get the previous row to the new row
  $previousRow = $newRow.prevAll(".added-row:first");

  //cycle through each input element on the new row
  $newRow.find(':input').each(function(){
    //Get a clean class to work with for the column
    var classToUse = getScClassForColumnCellInput(this);
    //Only continue if the column is part of the user's options.
    if (classToUse  && (jQuery.inArray(classToUse.toLowerCase(), columnsToInclude)>-1)) {
      //Bind the cell in the previous cell so that when it is changed the new row will update
      $previousRow.find('.'+classToUse).bind('change', changeIn2ndToLastRowProxy);
      //We set the value for the new row from the previous row if there is a value set on the previous row cell
      //and the user has included that column in their options. (inArray reurns -1 for items not found)
      if ($previousRow.find('.'+classToUse).val() && (jQuery.inArray(classToUse.toLowerCase(), columnsToInclude)>-1)) {
        jQuery(this).val($previousRow.find('.'+classToUse).val());
      }
      //We need to unbind the 3rd last row as we no longer what changes for that cell to affect the last row.
      $previousRow.prevAll(".added-row:first").find('.'+classToUse).unbind('change', changeIn2ndToLastRowProxy);
    }

  });

}
