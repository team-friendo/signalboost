// retrieved from: 'https://us.commitchange.com/js/donate-button.v2.js'
// on: 2021-04-19
// sha256sum: abf113495892c5e90e509edd9ae2711bec6fa2348772aa231e44f2c696d28148
// line 6 added by us to prevent reloads
!(function(t) {
  // added by signalboost --v
  if (document.querySelector('.commitchange-donate').children.length > 0) return
  // ^--- added by signalboost
  function e(n) {
    if (a[n]) return a[n].exports
    var o = (a[n] = { i: n, l: !1, exports: {} })
    return t[n].call(o.exports, o, o.exports, e), (o.l = !0), o.exports
  }
  var a = {}
  ;(e.m = t),
    (e.c = a),
    (e.d = function(t, a, n) {
      e.o(t, a) ||
        Object.defineProperty(t, a, {
          configurable: !1,
          enumerable: !0,
          get: n,
        })
    }),
    (e.n = function(t) {
      var a =
        t && t.__esModule
          ? function() {
              return t.default
            }
          : function() {
              return t
            }
      return e.d(a, 'a', a), a
    }),
    (e.o = function(t, e) {
      return Object.prototype.hasOwnProperty.call(t, e)
    }),
    (e.p = ''),
    e((e.s = 0))
})([
  function(t, e, a) {
    'use strict'
    function n() {
      var t = window.navigator.userAgent,
        e = t.search('OS 11_\\d') > 0,
        a = t.search(' like Mac OS X') > 0
      return e && a
    }
    var o =
      Object.assign ||
      function(t) {
        for (var e = 1; e < arguments.length; e++) {
          var a = arguments[e]
          for (var n in a)
            Object.prototype.hasOwnProperty.call(a, n) && (t[n] = a[n])
        }
        return t
      }
    ;(window.commitchange = { iframes: [], modalIframe: null }),
      (commitchange.getParamsFromUrl = function(t) {
        for (
          var e = {}, a = [], n = location.search.substr(1).split('&'), o = 0;
          o < n.length;
          o++
        )
          (a = n[o].split('=')),
            t.indexOf(a[0]) && (e[a[0]] = decodeURIComponent(a[1]))
        return e
      }),
      (commitchange.openDonationModal = function(t, e) {
        return function(a) {
          ;(e.className = 'commitchange-overlay commitchange-open'),
            (t.className = 'commitchange-iframe commitchange-open'),
            n() && (t.style.position = 'absolute'),
            commitchange.setParams(
              commitchange.getParamsFromButton(a.currentTarget, { modal: 't' }),
              t,
            ),
            n() && t.scrollIntoView(),
            (commitchange.open_iframe = t),
            (commitchange.open_overlay = e)
        }
      }),
      (commitchange.setParams = function(t, e) {
        ;(t.command = 'setDonationParams'),
          (t.sender = 'commitchange'),
          e.contentWindow.postMessage(JSON.stringify(t), i)
      }),
      (commitchange.hideDonation = function() {
        commitchange.open_overlay &&
          commitchange.open_iframe &&
          ((commitchange.open_overlay.className =
            'commitchange-overlay commitchange-closed'),
          (commitchange.open_iframe.className =
            'commitchange-iframe commitchange-closed'),
          n() && (commitchange.open_iframe.style.position = 'fixed'),
          (commitchange.open_overlay = void 0),
          (commitchange.open_iframe = void 0))
      })
    var i = 'https://us.commitchange.com'
    ;(commitchange.overlay = function() {
      var t = document.createElement('div')
      return (
        t.setAttribute('class', 'commitchange-closed commitchange-overlay'), t
      )
    }),
      (commitchange.createIframe = function(t) {
        var e = document.createElement('iframe'),
          a = document.location.href
        return (
          e.setAttribute('class', 'commitchange-closed commitchange-iframe'),
          (e.src = encodeURI(t + '&origin=' + a)),
          e
        )
      }),
      (commitchange.getParamsFromButton = function(t) {
        var e =
            arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
          a = o(
            {
              offsite: 't',
              type: t.getAttribute('data-type'),
              custom_amounts:
                t.getAttribute('data-custom-amounts') ||
                t.getAttribute('data-amounts'),
              amount: t.getAttribute('data-amount'),
              minimal: t.getAttribute('data-minimal'),
              weekly: t.getAttribute('data-weekly'),
              default: t.getAttribute('data-default'),
              custom_fields: t.getAttribute('data-custom-fields'),
              campaign_id: t.getAttribute('data-campaign-id'),
              gift_option_id: t.getAttribute('data-gift-option-id'),
              redirect: t.getAttribute('data-redirect'),
              designation: t.getAttribute('data-designation'),
              multiple_designations: t.getAttribute(
                'data-multiple-designations',
              ),
              hide_dedication: null !== t.getAttribute('data-hide-dedication'),
              manual_cover_fees:
                null !== t.getAttribute('data-manual-cover-fees'),
              hide_cover_fees_option:
                null !== t.getAttribute('data-hide-cover-fees-option'),
              designations_prompt: t.getAttribute('data-designations-prompt'),
              single_amount: t.getAttribute('data-single-amount'),
              designation_desc:
                t.getAttribute('data-designation-desc') ||
                t.getAttribute('data-description'),
              locale: t.getAttribute('data-locale'),
              utm_source: t.getAttribute('data-utm_source'),
              utm_campaign: t.getAttribute('data-utm_campaign'),
              utm_medium: t.getAttribute('data-utm_medium'),
              utm_content: t.getAttribute('data-utm_content'),
              first_name: t.getAttribute('data-first_name'),
              last_name: t.getAttribute('data-last_name'),
              country: t.getAttribute('data-country'),
              postal_code: t.getAttribute('data-postal_code'),
            },
            e,
          )
        for (var n in a) a[n] || delete a[n]
        return a
      }),
      (commitchange.appendMarkup = function() {
        if (!commitchange.alreadyAppended) {
          commitchange.alreadyAppended = !0
          for (
            var t =
                document.getElementById('commitchange-donation-script') ||
                document.getElementById('commitchange-script'),
              e = t.getAttribute('data-npo-id'),
              a = i + '/nonprofits/' + e + '/donate?offsite=t',
              n = document.querySelectorAll('.commitchange-donate'),
              o = 0;
            o < n.length;
            ++o
          ) {
            var c = n[o],
              m = a,
              r = commitchange.getParamsFromButton(c),
              d = commitchange.getParamsFromUrl([
                'utm_campaign',
                'utm_content',
                'utm_source',
                'utm_medium',
                'first_name',
                'last_name',
                'country',
                'postal_code',
                'address',
                'city',
              ])
            for (var s in r) d[s] = r[s]
            var u = []
            for (var g in d) u.push(g + '=' + d[g])
            if (((m += '&' + u.join('&')), c.hasAttribute('data-embedded'))) {
              m += '&mode=embedded'
              var l = commitchange.createIframe(m)
              c.appendChild(l),
                l.setAttribute('class', 'commitchange-iframe-embedded'),
                commitchange.iframes.push(l)
            } else {
              if (
                !c.hasAttribute('data-custom') &&
                !c.hasAttribute('data-custom-button')
              ) {
                var h = document.createElement('iframe'),
                  p = i + '/nonprofits/' + e + '/btn'
                c.hasAttribute('data-fixed') && (p += '?fixed=t'),
                  (h.src = encodeURI(p)),
                  (h.className = 'commitchange-btn-iframe'),
                  h.setAttribute('scrolling', 'no'),
                  h.setAttribute('seamless', 'seamless'),
                  c.appendChild(h),
                  (h.onclick = commitchange.openDonationModal(v, b))
              }
              var f = document.createElement('div')
              f.className = 'commitchange-modal'
              var b = commitchange.overlay(),
                v = void 0
              commitchange.modalIframe
                ? (v = commitchange.modalIframe)
                : ((v = commitchange.createIframe(m)),
                  commitchange.iframes.push(v),
                  (commitchange.modalIframe = v)),
                f.appendChild(b),
                document.body.appendChild(v),
                c.parentNode.appendChild(f),
                (b.onclick = commitchange.hideDonation),
                (c.onclick = commitchange.openDonationModal(v, b))
            }
          }
        }
      }),
      (commitchange.loadStylesheet = function() {
        if (!commitchange.alreadyStyled) {
          commitchange.alreadyStyled = !0
          var t = document.createElement('link')
          ;(t.href = 'https://us.commitchange.com/css/donate-button.v2.css'),
            (t.rel = 'stylesheet'),
            (t.type = 'text/css'),
            document.getElementsByTagName('head')[0].appendChild(t)
        }
      }),
      window.addEventListener &&
        window.addEventListener('message', function(t) {
          if ('commitchange:close' === t.data) commitchange.hideDonation()
          else if (t.data.match(/^commitchange:redirect/)) {
            var e = t.data.match(/^commitchange:redirect:(.+)$/)
            2 === e.length && (window.location.href = e[1])
          }
        }),
      document.addEventListener
        ? document.addEventListener('DOMContentLoaded', function(t) {
            commitchange.loadStylesheet(), commitchange.appendMarkup()
          })
        : window.jQuery
        ? window.jQuery(document).ready(function() {
            commitchange.loadStylesheet(), commitchange.appendMarkup()
          })
        : (window.onload = function() {
            commitchange.loadStylesheet(), commitchange.appendMarkup()
          }),
      document.querySelector('.commitchange-donate') &&
        (commitchange.loadStylesheet(), commitchange.appendMarkup())
  },
])
