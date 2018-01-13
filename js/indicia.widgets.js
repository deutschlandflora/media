/*
jQuery UI widgets - override existing UI plugons.
*/

$.widget("indicia.indiciaAutocomplete", $.ui.autocomplete, {
  options: {
    source: function(term, callback) {
      var params = {};
      $.extend(params, this.options.extraParams, {q: term.term, limit: 100});
      $.getJSON(this.options.baseUrl, params, callback);
    },
    extraParams: {},
    speciesMode: false,
    speciesIncludeAuthorities: false,
    speciesIncludeBothNames: false,
    speciesIncludeTaxonGroup: false,
    speciesIncludeIdDiff: true
  },

  _create: function() {
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

  _onSelect: function(event, ui) {
    this.valueInput.val(ui.item[this.options.valueField]);
    $(this.element).val(ui.item[this.options.captionField]);
    // @todo Selected item disappears
    console.log('Selected ' + ui.item[this.options.captionField]);
  },

  _onResponse: function(event, ui) {
    this.valueInput.val('');
    console.log('Cleared selection');
  },

  _formatSingleName(name, preferred, isLatin, authority, isSearchedName) {
    var display;
    var classes=[isSearchedName ? 'searched-name' : 'other-name'];
    if (isLatin) {
      classes.push('scientific');
      name = '<em>' + name + '</em>';
    } else if (isLatin === false) {
      classes.push('common');
    }
    if (preferred === 't') {
      classes.push('preferred');
    }
    display = '<div class="' + classes.join(' ') + '">' + name;
    if (this.options.speciesIncludeAuthorities && authority !== null) {
      display += ' ' + authority;
    }
    display += '</div>';
    return display;
  },

  _formatSpeciesItem: function(item) {
    var display = this._formatSingleName(
      item.taxon,
      item.preferred,
      typeof item.language_iso === "undefined" ? null : item.language_iso === 'lat',
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
      } else if (item.preferred='f'
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

  _renderItem: function(ul, item) {
    var display;
    if (this.options.speciesMode) {
      display = this._formatSpeciesItem(item);
    } else {
      display = item[this.options.captionField];
    }
    return $( "<li>" )
      .append('<div>' + display + '</div>')
      .appendTo( ul );
  }

});