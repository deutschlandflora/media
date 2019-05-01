/**
 * @file
 * A plugin for managing downloads from Elasticsearch.
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
 * Output plugin for data downloads.
 */
(function esDownloadPlugin() {
  'use strict';
  var $ = jQuery;

  /**
   * Place to store public methods.
   */
  var methods;

  /**
   * Flag to track when file generation completed.
   */
  var done;

  /**
   * Declare default settings.
   */
  var defaults = {
  };

  /**
   * Wind the progress spinner forward to a certain percentage.
   *
   * @param element el
   *   The plugin instance's element.
   * @param int progress
   *   Progress percentage.
   */
  function animateTo(el, progress) {
    var target = done ? 1006 : 503 + (progress * 503);
    // Stop previous animations if we are making better progress through the
    // download than 1 chunk per 0.5s. This allows the spinner to speed up.
    $(el).find('.circle').stop(true);
    $(el).find('.circle').animate({
      'stroke-dasharray': target
    }, {
      duration: 500
    });
  }

  /**
   * Updates the progress text and spinner after receiving a response.
   *
   * @param element el
   *   The plugin instance's element.
   * @param obj response
   *   Response body from the ES proxy containing progress data.
   */
  function updateProgress(el, response) {
    $(el).find('.progress-text').text(response.done + ' of ' + response.total);
    animateTo(el, response.done / response.total);
  }

  /**
   * Recurse until all the pages of a chunked download are received.
   *
   * @param obj data
   *   Response body from the ES proxy containing progress data.
   */
  function doPages(el, data) {
    var date;
    var hours;
    var minutes;
    if (data.done < data.total) {
      // Post to the ES proxy. Pass scroll_id parameter to request the next
      // chunk of the dataset.
      $.ajax({
        url: indiciaData.esProxyAjaxUrl + '/download/' + indiciaData.nid,
        type: 'post',
        data: {
          scroll_id: data.scroll_id
        },
        success: function success(response) {
          updateProgress(el, response);
          doPages(el, response);
        },
        dataType: 'json'
      });
    } else {
      date = new Date();
      date.setTime(date.getTime() + (45 * 60 * 1000));
      hours = '0' + date.getHours();
      hours = hours.substr(hours.length - 2);
      minutes = '0' + date.getMinutes();
      minutes = minutes.substr(minutes.length - 2);
      $(el).find('.progress-circle-container').addClass('download-done');
      $(el).find('.idc-download-files').append('<div><a href="' + data.filename + '">' +
        '<span class="fas fa-file-archive fa-2x"></span>' +
        'Download .zip file</a><br/>' +
        'File containing ' + data.total + ' occurrences. Available until ' + hours + ':' + minutes + '</div>');
      $(el).find('.idc-download-files').fadeIn('med');
    }
  }

  /**
   * Initialise the user interface event handlers.
   */
  function initHandlers(el) {
    /**
     * Download button click handler.
     */
    $(el).find('.do-download').click(function doDownload() {
      var data;
      var sources = JSON.parse($(el).attr('data-es-source'));
      $.each(sources, function eachSource(sourceId) {
        var source = indiciaData.esSourceObjects[sourceId];
        if (typeof source === 'undefined') {
          indiciaFns.controlFail(el, 'Download source not found.');
        }
        $(el).find('.progress-circle-container').removeClass('download-done');
        $(el).find('.progress-circle-container').show();
        done = false;
        $(el).find('.circle').attr('style', 'stroke-dashoffset: 503px');
        $(el).find('.progress-text').text('Loading...');
        data = indiciaFns.getFormQueryData(source);
        // Post to the ES proxy.
        $.ajax({
          url: indiciaData.esProxyAjaxUrl + '/download/' + indiciaData.nid,
          type: 'post',
          data: data,
          success: function success(response) {
            if (typeof response.code !== 'undefined' && response.code === 401) {
              alert('Elasticsearch alias configuration user or secret incorrect in the form configuration.');
              $('.progress-circle-container').hide();
            } else {
              updateProgress(el, response);
              doPages(el, response);
            }
          }
        });
      });
    });
  }

  /**
   * Declare public methods.
   */
  methods = {

    /**
     * Initialise the idcEsDownload plugin.
     *
     * @param array options
     */
    init: function init(options) {
      var el = this;

      indiciaFns.registerOutputPluginClass('idcEsDownload');
      el.settings = $.extend({}, defaults);
      // Apply settings passed in the HTML data-* attribute.
      if (typeof $(el).attr('data-idc-config') !== 'undefined') {
        $.extend(el.settings, JSON.parse($(el).attr('data-idc-config')));
      }
      // Apply settings passed to the constructor.
      if (typeof options !== 'undefined') {
        $.extend(el.settings, options);
      }
      initHandlers(el);
    },

    /*
     * The download plugin doesn't do anything until requested.
     */
    populate: function populate() {
      // Nothing to do.
    }
  };

  /**
   * Extend jQuery to declare idcEsDownload plugin.
   */
  $.fn.idcEsDownload = function buildEsDownload(methodOrOptions) {
    var passedArgs = arguments;
    $.each(this, function callOnEachDiv() {
      if (methods[methodOrOptions]) {
        // Call a declared method.
        return methods[methodOrOptions].apply(this, Array.prototype.slice.call(passedArgs, 1));
      } else if (typeof methodOrOptions === 'object' || !methodOrOptions) {
        // Default to "init".
        return methods.init.apply(this, passedArgs);
      }
      // If we get here, the wrong method was called.
      $.error('Method ' + methodOrOptions + ' does not exist on jQuery.idcEsDownload');
      return true;
    });
    return this;
  };
}());
