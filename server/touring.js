Days = new Meteor.Collection('days');

Meteor.methods({
  reset: function() {
    var stops = ["Seattle, WA",
                 "Olympia, WA",
                 "Yakima, WA",
                 "Spokane, WA",
                 "Portland, OR",
                 "Seaside, OR",
                 "Eugene, OR"
  ];
    for (var i = 0; i < stops.length; i++)
      Days.insert({stop: stops[i], order: i+1, created_at: Date.now(), updated_at: Date.now()});
  }
})
Meteor.startup(function () {
  if (Days.find().count() === 0) {
    Meteor.call('reset');
  }
});
