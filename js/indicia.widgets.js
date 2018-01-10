/*
jQuery UI widgets - override existing UI plugons.
*/

$.widget("indicia.indiciaAutocomplete", $.ui.autocomplete, {
  options: {
    source: function(term, callback) {
      var params = {};
      $.extend(params, this.options.extraParams, {q: term.term});
      $.getJSON(this.options.baseUrl, params, callback);
    },
    response: function(event, ui) {
      console.log('response is here');
    }
  },

  _init: function() {
    console.log('In init of our widget');
    this._super();
  },

  _renderItem: function(ul, item) {
    display = typeof item.highlighted === "undefined" ? item[this.options.captionField] : item.highlighted;
    display = display.replace(/^'+/, '').replace(/'+$/, '');

    // @todo Taxa_search needs to return an italicesd version
    // @todo Species formattings, standard formatting, documentation for adding new formatter

    return $( "<li>" )
      .attr( "data-value", item.id )
      .append(display)
      .appendTo( ul );
  }

});