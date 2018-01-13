/*
jQuery UI widgets - override existing UI plugons.
*/

$.widget('indicia.indiciaAutocomplete', $.ui.autocomplete, {
  options: {
    source: function (term, callback) {
      var params = {};
      $.extend(params, this.options.extraParams, { q: term.term, limit: 100 });
      $.getJSON(this.options.baseUrl, params, callback);
    },
    extraParams: {},
    speciesMode: false,
    speciesIncludeAuthorities: false,
    speciesIncludeBothNames: false,
    speciesIncludeTaxonGroup: false,
    speciesIncludeIdDiff: true
  },

  /**
   * Constructor. Adds a hidden input for the value and links event handlers.
   */
  _create: function () {
    this._super();
    // Autogenerate a hidden input to hold the selected ID.
    this.valueInput = $('<input>')
      .attr('type', 'text')
      .attr('id', this.options.id)
      .val(this.options.default);
    $(this.element).after(this.valueInput);
    this._on(this.element, {
      indiciaautocompleteselect: this._onSelect,
      indiciaautocompleteresponse: this._onResponse
    });
  },

  /**
   * On select of an item, fill in the value and caption.
   */
  _onSelect: function (event, ui) {
    this.valueInput.val(ui.item[this.options.valueField]);
    $(this.element).val(ui.item[this.options.captionField]);
    // @todo Selected item disappears
  },

  /**
   * Response handler.
   *
   * On AJAX response, clear the current value in the hidden input.
   */
  _onResponse: function () {
    this.valueInput.val('');
  },

  /**
   * Formats a taxon name and adds classes for display in the search menu.
   */
  _formatSingleName: function (name, preferred, isLatin, authority, isSearchedName) {
    var display;
    var formattedName = isLatin ? '<em>' + name + '</em>' : name;
    var classes = [
      isSearchedName ? 'searched-name' : 'other-name',
      isLatin ? 'scientific' : 'common'
    ];
    if (this.options.formattedName && authority !== null) {
      formattedName += ' ' + authority;
    }
    if (preferred === 't') {
      classes.push('preferred');
    }
    display = '<div class="' + classes.join(' ') + '">' + formattedName + '</div>';
    return display;
  },

  /**
   * Formats a species response from the taxa_search service.
   */
  _formatSpeciesItem: function (item) {
    var display = this._formatSingleName(
      item.taxon,
      item.preferred,
      typeof item.language_iso === 'undefined' ? null : item.language_iso === 'lat',
      item.authority,
      true
    );
    if (this.options.speciesIncludeBothNames) {
      if (item.preferred === 't'
        && item.default_common_name !== item.taxon && item.default_common_name) {
        display += this._formatSingleName(
          item.default_common_name,
          false,
          false,
          null,
          false
        );
      } else if (item.preferred === 'f'
        && (item.preferred_taxon !== item.taxon || item.preferred_authority !== item.authority)) {
        display += this._formatSingleName(
          item.preferred_taxon,
          true,
          true,
          item.preferred_authority,
          false
        );
      }
    }
    if (this.options.speciesIncludeTaxonGroup) {
      display += '<div class="taxon-group">' + item.taxon_group + '</div>';
    }
    return display;
  },

  /**
   * Widget _renderItem handler.
   */
  _renderItem: function (ul, item) {
    var display;
    if (this.options.speciesMode) {
      display = this._formatSpeciesItem(item);
    } else {
      display = item[this.options.captionField];
    }
    return $('<li>')
      .append('<div>' + display + '</div>')
      .appendTo(ul);
  }

});
