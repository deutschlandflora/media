/*
jQuery UI widgets - override existing UI plugons.
*/

$.widget("indicia.indiciaAutocomplete", $.ui.autocomplete, {
  options: {
    source: function(term, callback) {
      var params = {};
      $.extend(params, this.options.extraParams, {q: term.term, limit: 100});
      $.getJSON(this.options.baseUrl, params, callback);
    }/*,
    response: function(event, ui) {
      // Clear the current selected key as the user has changed the search text.
      $('#' + $(this).attr('data-id-input').replace(/:/g, '\\:')).val('');
      console.log('response is here');
    }*/
  },

  _create: function() {
    this._super();
    this._on(this.element, {
      indiciaautocompleteselect: this._onSelect
    });
  },

  _onSelect: function(event, ui) {
    $('#' + this.options.id.replace(/:/g, '\\:')).val(ui.item[this.options.valueField]);
    $(this.element).val(ui.item[this.options.captionField]);
    console.log('Item selected');
  },

  /*_init: function() {
    console.log('In init of our widget');
    this._super();
  },*/

  _renderItem: function(ul, item) {
    display = typeof item.highlighted === "undefined" ? item[this.options.captionField] : item.highlighted;
    display = display.replace(/^'+/, '').replace(/'+$/, '');

    // @todo Taxa_search needs to return an italicesd version
    // @todo Species formattings, standard formatting, documentation for adding new formatter

    return $( "<li>" )
      .attr( "data-value", item[this.options.valueField] )
      .append(item[this.options.captionField])
      .appendTo( ul );
  }

});