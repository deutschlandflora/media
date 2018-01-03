/**
 * Additional jQuery validation functions for Indicia.
 */

(function ($) {

  // Requires a minimum n figure grid reference
  $.validator.addMethod('mingridref', function (value, element, params) {
    var nosp = value.replace(/ /g, '');
    // note the 2nd part of this allows a non-grid ref through.
    return this.optional(element) ||
      !(/^[a-zA-Z]([a-zA-Z])?[0-9]*[A-NP-Za-np-z]?$/.test(nosp)) ||
      nosp.replace(/^[a-zA-Z]([a-zA-Z])?/, '').length >= params;
  }, 'Please supply at least a {0} figure grid reference precision');

  // Requires a maximum n figure grid reference
  $.validator.addMethod('maxgridref', function (value, element, params) {
    var nosp = value.replace(/ /g, '');
    // note the 2nd part of this allows a non-grid ref through.
    return this.optional(element) ||
      !(/^[a-zA-Z]([a-zA-Z])?[0-9]*[A-NP-Za-np-z]?$/.test(nosp)) ||
      nosp.replace(/^[a-zA-Z]([a-zA-Z])?/, '').length <= params;
  }, 'Please supply a {0} figure grid reference precision or less');

  // Make sure user cannot enter junk into the taxon cell and continue with submit
  $.validator.addMethod('speciesMustBeFilled', function (value, element) {
    var presenceCellInput = $(element).parents('tr:first').find('.scPresenceCell').children(':input');
    if ($(presenceCellInput).val() || !$(element).val()) {
      return true;
    }
  }, '');

  // Ensure a linked location for a sample contains the grid square.
  $.validator.addMethod('validateLinkedLocationAgainstGridSquare', function (value, element) {
    var ctrlName = $(element).attr('name').replace(/:name$/, '').replace(/:/g, '\\:');
    var locationId = $('input[name="' + ctrlName + '"]').val();
    return locationId === '' || typeof indiciaData.allPossibleLocationIds === 'undefined' ||
        $.inArray(locationId, indiciaData.allPossibleLocationIds) > -1;
  }, 'The location is not in the chosen grid square.');

  // Override default error messages with our own if required.
  $.extend($.validator.messages, {
    integer: 'A whole number please'
  });

}(jQuery));