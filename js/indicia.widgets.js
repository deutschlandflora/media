/*
jQuery UI widgets - override existing UI plugons.
*/
(function ($) {

  $.widget('indicia.indiciaAutocomplete', $.ui.autocomplete, {
    menuEntries: [],

    options: {
      source: function (term, callback) {
        var params = {};
        $.extend(params, this.options.extraParams, { q: term.term, limit: 100, synonyms: true });
        $.getJSON(this.options.baseUrl, params, callback);
      },
      extraParams: {},
      // Mode options are default, species, person.
      mode: 'default',
      formatOptions: {}
    },

    /**
     * Constructor. Adds a hidden input for the value and links event handlers.
     */
    _create: function () {
      this._super();
      // Apply default format options depending on the mode.
      if (this.options.mode === 'species') {
        this.options.formatOptions = $.extend({}, {
          speciesIncludeBothNames: false,
          speciesIncludeAuthorities: false,
          speciesIncludeTaxonGroup: false,
          speciesIncludeIdDiff: true
        }, this.options.formatOptions);
      }
      // Autogenerate a hidden input to hold the selected ID.
      this.valueInput = $('<input>')
        .attr('type', 'hidden')
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
      // Prevent the default behaviuor overwriting the displayed value.
      return false;
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
      if (this.options.formatOptions.speciesIncludeAuthorities && authority !== null) {
        formattedName += ' ' + authority;
      }
      if (preferred) {
        classes.push('preferred');
      } else if (isLatin) {
        formattedName += ' [syn]';
      }
      display = '<div class="' + classes.join(' ') + '">' + formattedName + '</div>';
      return display;
    },

    /**
     * Formats a species response from the taxa_search service.
     */
    _formatSpeciesItem: function (item) {
      // Add the name we are searching for.
      var display = this._formatSingleName(
        item.taxon,
        item.preferred === 't',
        typeof item.language_iso === 'undefined' ? null : item.language_iso === 'lat',
        item.authority,
        true
      );
      // Adds a common name (if searching for latin) or vice versa if configured
      // to do so.
      if (this.options.formatOptions.speciesIncludeBothNames) {
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
      // Add the taxon group.
      if (this.options.formatOptions.speciesIncludeTaxonGroup) {
        display += '<div class="taxon-group">' + item.taxon_group + '</div>';
      }
      // Adds an identification difficulty icon if required.
      if (this.options.formatOptions.speciesIncludeIdDiff &&
          item.identification_difficulty && item.identification_difficulty > 1) {
        display += ' <span ' +
          'class="item-icon id-diff id-diff-' + item.identification_difficulty + '" ' +
          'data-diff="' + item.identification_difficulty + '" ' +
          'data-rule="' + item.id_diff_verification_rule_id + '"></span>';
      }
      return display;
    },

    /**
     * At the start of loading the results menu, clear the tracker for
     * duplicates.
     */
    _startRendering: function() {
      this.menuEntries = [];
    },

    /**
     * Returns true if this name a duplicate of one already in the results
     * menu. A name is considered duplicate if the taxon_meaning_id and
     * visible label are the same - i.e. 2 names for a taxon concept with
     * different author strings are considered duplicates unless
     * speciesIncludeAuthorities is enabled.
     */
    _doneEntry: function(item) {
      var display;
      if (this.options.mode === 'species') {
        // Work out a unique key for this taxon concept/name.
        display = item.taxon_meaning_id + ':' + item.taxon;
        // Only include the authority if the user can see it.
        if (this.options.speciesIncludeAuthorities) {
          display += ':' + item.authority;
        }
        // If this name is unique or the first instance, show it.
        if ($.inArray(display, this.menuEntries) === -1) {
          this.menuEntries.push(display);
        } else {
          return true;
        }
      } else {
        return false;
      }
    },

    /**
     * Widget _renderManu handler.
     */
    _renderMenu: function(ul, items) {
      var that = this;
      this._startRendering();


      $.each(items, function(index, item) {
        if (!that._doneEntry(item)) {
          that._renderItemData(ul, item);
        }
      });
      // Alternate entry styling.
      $(ul).find('li:odd').addClass('odd');
    },

    /**
     * Widget _renderItem handler. Delegates to the rendering handler for the current mode.
     */
    _renderItem: function (ul, item) {
      var display;
      if (this.options.mode === 'species') {
        display = this._formatSpeciesItem(item);
      } else {
        display = item[this.options.captionField];
      }
      return $('<li>')
        .append('<div>' + display + '</div>')
        .appendTo(ul);
    }

  });
}(jQuery));
