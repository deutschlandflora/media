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
 * File containing general purpose JavaScript functions for Indicia.
 */
if (typeof window.indiciaData === 'undefined') {
  window.indiciaData = {
    onloadFns: [],
    idDiffRuleMessages: {},
    documentReady: 'no',
    windowLoaded: 'no',
    reports: {},
    lang: [],
    ctrlPressed: false,
    shiftPressed: false,
    linkedSelects: []
  };
  window.indiciaFns = {};
}

(function ($) {
  'use strict';

  /**
   * Keep track of modifier keys such as shift anc ctrl as generally useful.
   */
  $(document).keydown(function keyDown(evt) {
    if (evt.keyCode === 17) { // ctrl
      indiciaData.ctrlPressed = true;
    } else if (evt.keyCode === 16) {
      indiciaData.shiftPressed = true;
    }
  }).keyup(function keyUp(evt) {
    if (evt.keyCode === 17) { // ctrl
      indiciaData.ctrlPressed = false;
    } else if (evt.keyCode === 16) {
      indiciaData.shiftPressed = false;
    }
  }).blur(function blur() {
    indiciaData.ctrlPressed = false;
  });

  /**
   * Add a handy jQuery function for ignoring certain content elements, e.g. $(el).ignore('.skip').text() gets the
   * text from the outer element skipping anything inside with a .skip class.
   */
  $.fn.ignore = function(sel) {
    return this.clone().find(sel || '>*').remove().end();
  };

  /**
   * Enable buttons hover Effect. Since jQuery 1.7 the 'live' function has been
   * deprecated and 'on' function should be used. Use this function to allow
   * non-version specific code.
   */
  indiciaFns.enableHoverEffect = function () {
    var version = $.fn.jquery.split('.');
    var funcname = (version[0] === '1' && version[1] < 7) ? 'live' : 'on';

    $('.ui-state-default')[funcname]('mouseover', function () {
      $(this).addClass('ui-state-hover');
    });
    $('.ui-state-default')[funcname]('mouseout', function () {
      $(this).removeClass('ui-state-hover');
    });
  };

  indiciaFns.initFindMe = function (hint) {
    if ($('input.findme').nextAll('.ctrl-addons').length > 0) {
      $('input.findme').nextAll('.ctrl-addons').append('<span id="findme-icon" title="' + hint + '">&nbsp;</span>');
    }
    else {
      $('input.findme').after('<span id="findme-icon" title="' + hint + '">&nbsp;</span>');
    }
    $('#findme-icon').click(indiciaFns.findMe);
  };

  indiciaFns.findMe = function () {
    var onSuccess = function (position) {
      var lonLat;
      $('#findme-icon').removeClass('spinning');
      // transform from WGS 1984 to Web  Mercator Projection
      lonLat = new OpenLayers.LonLat(position.coords.longitude, position.coords.latitude)
        .transform(
          new OpenLayers.Projection('EPSG:4326'),
          indiciaData.mapdiv.map.getProjectionObject()
        );
      indiciaData.mapdiv.map.setCenter(lonLat, 17);
      // Use the new map centre for processing, as dynamic layers mean the
      // projection might switch so lonLat cannot be trusted.
      indiciaData.mapdiv.processLonLatPositionOnMap(indiciaData.mapdiv.map.getCenter(), indiciaData.mapdiv);
    };
    var onFail = function () {
      $('#findme-icon').removeClass('spinning');
      alert('Your current position could not be found.');
    };
    $('#findme-icon').addClass('spinning');
    navigator.geolocation.getCurrentPosition(onSuccess, onFail);
  };

  /**
   * Method to attach to the hover event of an id difficulty warning icon. The icon should have
   * data-rule and data-diff attributes, pointing to to the rule ID and id difficulty level
   * respectively.
   */
  indiciaFns.hoverIdDiffIcon = function (e) {
    var $elem = $(e.currentTarget);
    if (!$elem.attr('title')) {
      // Hovering over an ID difficulty marker, so load up the message hint. We load the whole
      // lot for this rule, to save multiple service hits. So check if we've loaded this rule already
      if (typeof indiciaData.idDiffRuleMessages['rule' + $elem.attr('data-rule')] === 'undefined') {
        $.ajax({
          dataType: 'jsonp',
          url: indiciaData.read.url + 'index.php/services/data/verification_rule_datum',
          data: {
            verification_rule_id: $elem.attr('data-rule'),
            header_name: 'INI',
            auth_token: indiciaData.read.auth_token,
            nonce: indiciaData.read.nonce
          },
          success: function (data) {
            // JSONP can't handle http status code errors. So error check in success response.
            if (typeof data.error !== 'undefined') {
              // put a default in place.
              $elem.attr('title', 'Caution, identification difficulty level ' + $elem.attr('data-rule') + ' out of 5');
            } else {
              indiciaData.idDiffRuleMessages['rule' + $elem.attr('data-rule')] = {};
              $.each(data, function (idx, msg) {
                indiciaData.idDiffRuleMessages['rule' + $elem.attr('data-rule')]['diff' + msg.key] = msg.value;
              });
              $(e.currentTarget).attr('title',
                  indiciaData.idDiffRuleMessages['rule' + $elem.attr('data-rule')]['diff' + $elem.attr('data-diff')]);
            }
          }
        });
      } else {
        $elem.attr('title',
          indiciaData.idDiffRuleMessages['rule' + $elem.attr('data-rule')]['diff' + $elem.attr('data-diff')]);
      }
    }
  };

  /**
   * Select a jQuery tab or return the index of the current selected one.
   * jQuery UI 1.10 replaced option.selected with option.active. Use this function to allow non-version specific
   * code.
   */
  indiciaFns.activeTab = function activeTab(tabs, index) {
    var version = $.ui.version.split('.');
    var versionPre1x10 = version[0] === '1' && version[1] < 10;
    var tabIndex;
    if (typeof index === 'undefined') {
      // Getting a tab index
      if (versionPre1x10) {
        return tabs.tabs('option', 'selected');
      }
      return tabs.tabs('option', 'active');
    }
    // Setting selected tab index. If index is passed as the tab's ID, convert to numeric index.
    tabIndex = $('#' + index + '-tab').index();
    if (versionPre1x10) {
      return tabs.tabs('select', tabIndex);
    }
    return tabs.tabs('option', 'active', tabIndex);
  };

  /**
   * jQuery UI 1.10 replaced the show event with activate. Use this function to allow non-version specific
   * code to bind to this event
   */
  indiciaFns.bindTabsActivate = function (tabs, fn) {
    var version = $.ui.version.split('.');
    var evtname = (version[0] === '1' && version[1] < 10) ? 'tabsshow' : 'tabsactivate';
    return tabs.bind(evtname, fn);
  };

  /**
   * jQuery UI 1.10 replaced the show event with activate. Use this function to allow non-version specific
   * code to unbind from this event
   */
  indiciaFns.unbindTabsActivate = function (tabs, fn) {
    var version = $.ui.version.split('.');
    var evtname = (version[0] === '1' && version[1] < 10) ? 'tabsshow' : 'tabsactivate';
    return tabs.unbind(evtname, fn);
  };

  /**
   * jQuery UI 1.10 replaced the url method with the href attribute. Use this function to allow
   * non-version specific code to set the target of a remote tab.
   */
  indiciaFns.setTabHref = function (tabs, tabIdx, liId, href) {
    var version = $.ui.version.split('.');
    if (version[0] === '1' && version[1] < 10) {
      tabs.tabs('url', tabIdx, href);
    } else {
      $('#' + liId + ' a').attr('href', href);
    }
  };

  /**
   * jQuery version independent .live/.delegate/.on code.
   */
  indiciaFns.on = function (events, selector, data, handler) {
    var version = jQuery.fn.jquery.split('.');
    if (version[0] === '1' && version[1] < 4) {
      $(selector).live(events, handler);
    } else if (version[0] === '1' && version[1] < 7) {
      $(document).delegate(selector, events, data, handler);
    } else {
      $(document).on(events, selector, data, handler);
    }
  };

  /**
   * jQuery version independent .die/.undelegate/.off code.
   */
  indiciaFns.off = function (event, selector, handler) {
    var version = jQuery.fn.jquery.split('.');
    if (version[0] === '1' && version[1] < 4) {
      $(selector).die(event, handler);
    } else if (version[0] === '1' && version[1] < 7) {
      $(document).undelegate(selector, event, handler);
    } else {
      $(document).off(event, selector, handler);
    }
  };

  /**
   * Retrieves an array containing all the current URL query parameters.
   * @returns {Array}
   */
  indiciaFns.getUrlVars = function () {
    var vars = {};
    var hash;
    var splitPos = window.location.href.indexOf('?');
    var hashes = window.location.href.slice(splitPos + 1).split('&');
    var i;
    if (splitPos !== -1) {
      for (i = 0; i < hashes.length; i++) {
        hash = hashes[i].split('=');
        vars[hash[0]] = hash[1];
      }
    }
    return vars;
  };

  /**
   * Convert any projection representation to a system string.
   * @param string|object proj An EPSG projection name recognised by OpenLayers or a projection object
   * @return string
   */
  indiciaFns.projectionToSystem = function (proj, convertGoogle) {
    var system;
    if (typeof proj !== 'string') { // assume a OpenLayers Projection Object
      system = proj.getCode();
    } else {
      system = proj;
    }
    if (system.substring(0, 5) === 'EPSG:') {
      system = system.substring(5);
    }
    if (convertGoogle && system === '900913') {
      system = '3857';
    }
    return system;
  };

  /**
   * Utility function, equivalent to htmlspecialchars in PHP.
   * @param string text
   * @returns string
   */
  indiciaFns.escapeHtml = function (text) {
    var map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function (m) { return map[m]; });
  };

  // Some functions relating to location controls
  indiciaFns.locationControl = [];

  /**
   * Function which uses the ID of the currently selected location ID to grab any previously input sample attribute
   * values by the same user and populate them into the relevant controls.
   * For example, a user picks their local nature reserve as a location and provides a habitat. The next time the
   * same location is picked by that user, the same habitat is auto-filled in.
   */
  indiciaFns.locationControl.fetchLocationAttributesIntoSample = function (locCntrlId, warehouseUserId) {
    var locCntrlIdEscaped = locCntrlId.replace(':', '\\:');
    var reportingURL = indiciaData.read.url + 'index.php/services/report/requestReport' +
      '?report=library/sample_attribute_values/get_latest_values_for_site_and_user.xml&callback=?';
    var reportOptions = {
      mode: 'json',
      nonce: indiciaData.read.nonce,
      auth_token: indiciaData.read.auth_token,
      reportSource: 'local',
      location_id: $('#' + locCntrlIdEscaped).attr('value'),
      created_by_id: warehouseUserId
    };
    if ($('#' + locCntrlIdEscaped).attr('value') !== '') {
      // Fill in the sample attributes based on what is returned by the report
      $.getJSON(reportingURL, reportOptions,
        function (data) {
          jQuery.each(data, function (i, item) {
            var selector = 'smpAttr\\:' + item.id;
            var input = $('[id=' + selector + '],[name=' + selector + ']');
            if (item.value !== null && item.data_type !== 'Boolean') {
              input.val(item.value);
              if (input.is('select') && input.val() === '') {
                // not in select list, so have to add it
                input.append('<option value="' + item.value + '">' + item.term + '</option>');
                input.val(item.value);
              }
            }
            // If there is a date value then we use the date field instead.
            // This is because the vague date engine returns to this special field
            if (typeof item.value_date !== 'undefined' && item.value_date !== null) {
              input.val(item.value_date);
            }
            // booleans need special treatment because checkboxes rely on using the'checked' attribute instead of using
            // the value.
            if (item.value_int === '1' && item.data_type === 'Boolean') {
              input.attr('checked', 'checked');
            }
            if (item.value_int === '0' && item.data_type === 'Boolean') {
              input.removeAttr('checked');
            }
          });
        }
      );
    }
  };

  function addLinkedLocationBoundary(wkt) {
    var geom;
    var feature;
    geom = OpenLayers.Geometry.fromWKT(wkt);
    if (indiciaData.mapdiv.map.projection.getCode() !== indiciaData.mapdiv.indiciaProjection.getCode()) {
      geom.transform(indiciaData.mapdiv.indiciaProjection, indiciaData.mapdiv.map.projection);
    }
    feature = new OpenLayers.Feature.Vector(geom);
    feature.attributes.type = 'linkedboundary';
    indiciaData.mapdiv.map.editLayer.addFeatures([feature]);
  }

  indiciaFns.locationControl.autoFillLocationFromLocationTypeId = function (locCntrlId, locationTypeId) {
    var locCntrlIdEscaped = locCntrlId.replace(':', '\\:');
    var reportingURL = indiciaData.read.url + 'index.php/services/report/requestReport' +
      '?report=library/locations/locations_list_mapping.xml&callback=?';
    var reportOptions = {
      mode: 'json',
      nonce: indiciaData.read.nonce,
      auth_token: indiciaData.read.auth_token,
      reportSource: 'local',
      bounds: $('#imp-geom').attr('value'),
      location_type_id: locationTypeId,
      exclude_composites: 1
    };

    $.getJSON(reportingURL, reportOptions,
      function (data) {
        var popupHtml;
        var checkedRadio;
        var alreadySet = false;
        indiciaData.allPossibleLocationIds = [];
        if (typeof data.error === 'undefined') {
          $.each(data, function storeId() {
            indiciaData.allPossibleLocationIds.push(this.id);
          });
          if (data.length === 1) {
            // single unique matching location found
            $('#' + locCntrlIdEscaped).val(data[0].id);
            $('#' + locCntrlIdEscaped + '\\:name').val(data[0].name);
            addLinkedLocationBoundary(data[0].geom);
          } else if (data.length > 1) {
            // if populated already with something on the list, just use that one.
            popupHtml = '<p>' + indiciaData.langMoreThanOneLocationMatch + '</p>';
            popupHtml += '<ul>';
            $.each(data, function (idx) {
              if (this.id == $('#' + locCntrlIdEscaped).val()) {
                alreadySet = true;
                return false;
              }
              popupHtml += '<li><label>' +
                '<input type="radio" value="' + this.id + '" name="resolveLocation" + data-idx="' + idx + '"/> ' +
                this.name + '</label></li>';
              return true;
            });
            if (alreadySet) {
              // user already has a selected boundary which matches one of the options, so keep it.
              return;
            }
            popupHtml += '</ul>';
            popupHtml += '<button id="resolveLocationOk" disabled="disabled">Ok</button>';
            popupHtml += '<button id="resolveLocationCancel">Cancel</button>';
            $.fancybox('<div id="resolveLocationPopup">' + popupHtml + '</div>');
            $('#resolveLocationPopup input[type="radio"]').change(function () {
              $('#resolveLocationOk').removeAttr('disabled');
            });
            $('#resolveLocationOk').click(function () {
              checkedRadio = $('#resolveLocationPopup input[type="radio"]:checked');
              $('#' + locCntrlIdEscaped).val(checkedRadio.val());
              $('#' + locCntrlIdEscaped + '\\:name').val(checkedRadio.closest('label').text());
              $.fancybox.close();
              addLinkedLocationBoundary(data[$(checkedRadio).attr('data-idx')].geom);
            });
            $('#resolveLocationCancel').click(function () {
              $.fancybox.close();
            });
          }
        }
      }
    );
  };

  indiciaFns.locationControl.linkedLocationAttrValChange = function () {
    // Trigger validation test.
    $(this).valid();
    indiciaData.mapdiv.removeAllFeatures(indiciaData.mapdiv.map.editLayer, 'linkedboundary');
    if ($(this).val()) {
      // Display the location.
      $.getJSON(indiciaData.read.url + 'index.php/services/data/location/' + $(this).val() +
          '?mode=json&view=detail&auth_token=' + indiciaData.read.auth_token +
          '&nonce=' + indiciaData.read.nonce + '&callback=?', function (data) {
        addLinkedLocationBoundary(data[0].geom);
      });
    }
  };

  indiciaFns.afterFancyboxLoad = function(upcoming, previous) {
    var info = $(upcoming.element).parent().find('.image-info');
    var fancybox = $('.fancybox-outer');
    if (info.length && fancybox) {
      $(info).clone().show().appendTo(fancybox);
    }
  };

  /**
   * Linked selects parent change handler.
   *
   * When 2 select boxes are linked (so selecting an item in one filters the
   * other), this function handles the selection change and application of the
   * filter.
   */
  indiciaFns.changeLinkedParentSelect = function changeLinkedParentSelect(el, options) {
    var childSelect = $('#' + options.escapedId);
    var parentSelect = $(el);
    if (parentSelect.val()) {
      $.getJSON(options.request + '&query=' + options.query.replace('%22val%22', parentSelect.val()), function onResponse(data) {
        childSelect.find('option').remove();
        if (data.length > 0) {
          childSelect.removeClass('ui-state-disabled');
          childSelect.show();
          if (data.length > 1) {
            childSelect.append('<option value="">&lt;Please select&gt;</option>');
          }
          $.each(data, function eachData() {
            var selected = typeof indiciaData['default' + options.escapedId] !== 'undefined' && indiciaData['default' + options.escapedId] === this[options.valueField] ? '" selected="selected' : '';
            childSelect.append('<option value="' + this[options.valueField] + selected + '">' + this[options.captionField] + '</option>');
          });
        } else {
          if (options.hideChildrenUntilLoaded) {
            childSelect.hide();
          }
          childSelect.addClass('ui-state-disabled').html('<option disabled>' + options.instruct + '</option>');
        }
        childSelect.change();
      });
    } else {
      if (options.hideChildrenUntilLoaded) {
        childSelect.hide();
      }
      childSelect.addClass('ui-state-disabled').html('<option disabled>' + options.instruct + '</option>');
      childSelect.change();
    }
  };
}(jQuery));

jQuery(document).ready(function ($) {
  var iform;
  var confirmOnPageExit;
  var detectInput;

  // Hook up fancybox if enabled.
  if ($.fancybox) {
    $('a.fancybox').fancybox({ afterLoad: indiciaFns.afterFancyboxLoad });
  }

  if ($('form input[name=website_id]').length > 0) {
    iform = $('form input[name=auth_token]').parents('form');
    confirmOnPageExit = function (e) {
      var message = 'Are you sure you want to navigate away from this page? You will lose any data you have entered.';
      // If we haven't been passed the event get the window.event
      var evt = e || window.event;
      // For IE6-8 and Firefox prior to version 4
      if (evt) {
        evt.returnValue = message;
      }
      // For Chrome, Safari, IE8+ and Opera 12+
      return message;
    };
    detectInput = function () {
      window.onbeforeunload = confirmOnPageExit;
      $(iform).find(':input').unbind('change', detectInput);
    };
    // any data input, need to confirm if navigating away
    $(iform).find(':input').bind('change', detectInput);
    $(iform).submit(function () {
      // allowed to leave page on form submit
      window.onbeforeunload = null;
    });
  }
  // Close handler for x button on image information panels.
  indiciaFns.on('click', '.media-info-close', {}, function(e) {
    $(e.currentTarget).parent('.media-info').hide();
    return false;
  });

  $.each(indiciaData.linkedSelects, function() {
    var selectInfo = this;
    indiciaFns.on('change', '#' + this.parentControlId, {}, function onChange() {
      indiciaFns.changeLinkedParentSelect(this, selectInfo);
    });
    if ($('#' + this.escapedId + ' option').length === 0) {
      $('#' + this.parentControlId).trigger('change');
    }
  });
});
