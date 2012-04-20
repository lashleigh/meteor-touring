Template.header.greeting = function () {
  return "Welcome to touring.";
};

Template.days.days = function() {
  return Days.find({}, {sort: Session.get('sort')});
};
Template.days.events = {
  'click input#new_day_button': function() {
    var stop = $('#new_day_stop').val().replace(/(^\s+|\s+$)/g,'');
    if(stop.length > 5) {
      Days.insert({stop: stop, order: Days.find().count()+1, created_at: Date.now()});
      $('#new_day_stop').val('');
    }
  },
  'mouseout': function() {
    if(Session.get('hovered') && (Session.get('hovered') !== Session.get('current'))) markers[Session.get('hovered')].setIcon(null);
  },
  'click #sort_lat': function() {
    var old = Session.get('sort').lat
    if(old) {
      Session.set('sort', {lat: -1*old});
    } else {
      Session.set('sort', {lat: -1});
    }
  },
  'click #sort_lng': function() {
    var old = Session.get('sort').lng
    if(old) {
      Session.set('sort', {lng: -1*old});
    } else {
      Session.set('sort', {lng: -1});
    }
  },
  'click #sort_order': function() {
    Session.set('sort', {order: 1});
  },
  'click #reset_days': function() {
    Days.remove({});
    Meteor.call('reset');
  }
}
Template.day.sort_by_order = function() {
  return !!Session.get('sort').order;
}
Template.day.current = function() {
  return Session.get('current') === this._id ? ' current' : '';
}
Template.day.is_current = function() {
  return !!(Session.get('current') === this._id);
}
Template.day.events = {
  'click' : function (e) {
    // template data, if any, is available in 'this'
    make_current(this._id)
  },
  'mouseover': function() {
    Session.set('hovered', this._id);
    markers[this._id].setIcon(hover_icon);
  },
  'mouseout': function() {
    Session.set('hovered', null);
    if(Session.get('current') == this._id) {
      markers[this._id].setIcon(current_icon);
    } else {
      markers[this._id].setIcon(null);
    }
  },
  'dblclick .stop': function() {
    $('#'+this._id+' .stop').attr('contentEditable', true).focus();
  },
  'click .destroy': function(e) {
    e.stopPropagation();
    Days.remove({_id: this._id});
    adjust_order_after_remove(this);
  },
  'click .move_up': function(e) {
    //e.stopPropagation();
    move_one(this, -1);
  },
  'click .move_dn': function(e) {
    //e.stopPropagation();
    move_one(this, 1);
  },
  'click .directions': function(e) {
    calc_route(this);
  },
  'blur .stop': function() {
    $('#'+this._id+' .stop').attr('contentEditable', null)
  },
  'keydown .stop': function(e) {
    if(e.keyCode === 13) {
      e.preventDefault();
      var new_stop = $('#'+this._id+' .stop').text().replace(/(^\s+|\s+$)/g,'');
      if(new_stop.length > 3) {
        update_by_merging(this, {stop: new_stop})
      } else {
        if_console('too short');
        $('#'+this._id+' .stop').text(this.stop).blur();
      }
    }
  }
};
