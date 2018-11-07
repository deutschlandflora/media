
/* Indicia, the OPAL Online Recording Toolkit.
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

jQuery(document).ready(function docReady($) {
  indiciaFns.detectDuplicateFields = function detectDuplicateFields() {
    var valueStore = [];
    var duplicateStore = [];
    var valueStoreIndex = 0;
    var duplicateStoreIndex = 0;
    $.each($('.import-mappings-table select'), function () {
      var select = this;
      var i;
      if (valueStoreIndex === 0) {
        valueStore[valueStoreIndex] = select.value;
        valueStoreIndex++;
      } else {
        for (i = 0; i < valueStoreIndex; i++) {
          if (select.value === valueStore[i] && select.value !== '<' + indiciaData.lang.import.not_imported + '>') {
            duplicateStore[duplicateStoreIndex] = select.value;
            duplicateStoreIndex++;
          }
        }
        valueStore[valueStoreIndex] = select.value;
        valueStoreIndex++;
      }
    });
    if (duplicateStore.length === 0) {
      indiciaData.duplicateAllowsUpload = true;
      $('#duplicate-instruct').css('display', 'none');
    } else {
      indiciaData.duplicateAllowsUpload = false;
      $('#duplicate-instruct').css('display', 'inline');
    }
  };

  indiciaFns.updateRequiredFields = function updateRequiredFields() {
    var output = '';
    // copy the list of required fields
    var fields = $.extend(true, {}, required_fields);
    var sampleVagueDates = [];
    var locationReference = false;
    var fieldTokens;
    var thisValue;
    $('#required-instructions li').remove();
    // Default until we discover otherwise.
    indiciaData.requiredAllowsUpload = true;
    // Skip checking required fields if doing an existing value import.
    if ($('.lookupSelects option:selected[value!=""]').length === 0) {
      // strip out the ones we have already allocated
      $.each($('.import-mappings-table select'), function (i, select) {
        thisValue = select.value;
        // If there are several options of how to search a single lookup then they
        // are identified by a 3rd token, e.g. occurrence:fk_taxa_taxon_list:search_code.
        // These cases fulfil the needs of a required field so we can remove them.
        fieldTokens = thisValue.split(':');
        if (fieldTokens.length > 2) {
          fieldTokens.pop();
          thisValue = fieldTokens.join(':');
        }
        delete fields[thisValue];
        // special case for vague dates - if we have a complete sample vague date, then can strike out the sample:date required field
        if (select.value.substr(0, 12) === 'sample:date_') {
          sampleVagueDates.push(thisValue);
        }
        // and another special case for samples: can either include the sref or a foreign key reference to a location.
        if (select.value.substr(0, 18) === 'sample:fk_location') { // catches the code based fk as well
          locationReference = true;
        }
      });
      if (sampleVagueDates.length === 3) {
        // got a full vague date, so can remove the required date field
        delete fields['sample:date'];
      }
      if (locationReference) {
        // got a location foreign key reference, so can remove the required entered sref fields
        delete fields['sample:entered_sref'];
        delete fields['sample:entered_sref_system'];
      }
      $.each(fields, function(field, caption) {
        output += '<li>' + caption + '</li>';
        indiciaData.requiredAllowsUpload = false;
      });
    }
    $('#submit').attr('disabled', !(indiciaData.requiredAllowsUpload && indiciaData.duplicateAllowsUpload));
    $('#updating-instructions').css('display', $('.lookupSelects option:selected[value!=""]').length > 0 ? 'inline' : 'none');
    $('#required-instructions ul').html(output);
    $('#required-instructions').css('display', output === '' ? 'none' : 'inline');
  };

  // When a mapping is changed, this makes sure the options in the lookupSelects are valid for the new combination
  indiciaFns.checkLookupOptions = function checkLookupOptions() {
    var i;
    var field;
    var fields;
    var rows;
    if (!indiciaData.enableExistingDataLookup) {
      return;
    }
    $('.in-lookup').hide();
    $('.lookupSelects').each(function (idx, select) {
      $(select).find('option[value!=""]').each(function () {
        var option = this;
        var allFound = true;
        fields = JSON.parse($(option).val());
        for (i = 0; allFound && i < fields.length; i++) {
          if (typeof fields[i].notInMappings === 'undefined' || fields[i].notInMappings !== true) {
            if (fields[i].fieldName.indexOf('_id') >= 0) {
              field = fields[i].fieldName.replace('_id', '');
              if (field.indexOf(':') >= 0) {
                field = field.replace(':', ':fk_');
              } else {
                field = 'fk_' + field;
              }
            } else field = fields[i].fieldName;
            // If fields are part of the special grouping, then all must be present
            allFound &= (indiciaData.presetFields.indexOf(fields[i].fieldName) >= 0
              || indiciaData.presetFields.indexOf(field) >= 0
              || $('.import-mappings-table select option:selected')
                .filter(
                  '[value="' + field.replace(':', '\\:') + '"],' +
                  '[value^="' + field.replace(':', '\\:') + '\\:"],' +
                  '[value="' + fields[i].fieldName.replace(':', '\\:') + '"]'
                ).length > 0);
          }
        }
        if (allFound) {
          if ($(option).attr('disabled') === 'disabled') {
            $(option).removeAttr('disabled');
          }
        } else if ($(option).attr('disabled') !== 'disabled') {
          if ($(select).val() === $(option).val()) {
            $(select).val('');
          }
          $(option).attr('disabled', 'disabled');
        }
      });
      if ($(this).val() !== '') {
        fields = JSON.parse($(this).val());
        for (i = 0; i < fields.length; i++) {
          if (typeof fields[i].notInMappings === 'undefined' || fields[i].notInMappings !== true) {
            if (fields[i].fieldName.indexOf('_id') >= 0) {
              field = fields[i].fieldName.replace('_id', '');
              if (field.indexOf(':') >= 0) {
                field = field.replace(':', ':fk_');
              } else {
                field = 'fk_' + field;
              }
            } else field = fields[i].fieldName;
            rows = $('.import-mappings-table select option:selected')
              .filter(
                '[value="' + field.replace(':', '\\:') + '"],' +
                '[value^="' + field.replace(':', '\\:') + '\\:"],' +
                '[value="' + fields[i].fieldName.replace(':', '\\:') + '"]'
              ).closest('tr');
            rows.find('.in-lookup').show();
          }
        }
      }
    });
  };

  $('.lookupSelects').change(function lookupSelectChange() {
    indiciaFns.updateRequiredFields();
    indiciaFns.checkLookupOptions();
  });

  $('.import-mappings-table select').change(function mappingSelectChange() {
    indiciaFns.detectDuplicateFields();
    indiciaFns.updateRequiredFields();
    indiciaFns.checkLookupOptions();
  });
});
