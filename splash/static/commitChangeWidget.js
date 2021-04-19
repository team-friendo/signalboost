;(function() {
  if (document.getElementById('commitchange-script')) return
  var npo = 5859
  var script = document.createElement('script')
  var first = document.getElementsByTagName('script')[0]
  script.setAttribute('data-npo-id', npo)
  script.id = 'commitchange-script'
  script.src = 'https://us.commitchange.com/js/donate-button.v2.js'
  first.parentNode.insertBefore(script, first)
})()

// sha256sum of above script as of 2021-04-19:
// abf113495892c5e90e509edd9ae2711bec6fa2348772aa231e44f2c696d28148
