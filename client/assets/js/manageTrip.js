var manageTrip = {}; 
(function() {
  this.appendDay = function(point) {
    if(!point) return;
    munge_insert({lat:point.lat(), lng: point.lng()});
  }
  this.insertDayAfter = function(day, atPoint) {
    if(!day) return;
    if(Days.find({order: {$gt: day.order}}).count() !== 0) {
      if(day.polyline) {
        var path = myDecodePath(day.polyline);
        if(path.length > 2) {
          var midpoint = atPoint || path[Math.floor(path.length/2)];
          munge_update({order: {$gte: day.order+1}}, {$inc: {order: 1}}, {multi: true});
          munge_update(day._id, {$set: {waypoints: []}}); //TODO Unfortunate but how else would I keep the waypoint order straight?
          munge_insert({lat: midpoint.lat(), lng:midpoint.lng(), order: day.order+1});
        } else {
          var next_day = Days.findOne({order: day.order + 1});
          var half_lat = atPoint ? atPoint.lat() : day.lat - (day.lat - next_day.lat) / 2;
          var half_lng = atPoint ? atPoint.lng() : day.lng - (day.lng - next_day.lng) / 2;
          munge_update({order: {$gte: day.order+1}}, {$inc: {order: 1}}, {multi: true});
          munge_update(day._id, {$set: {waypoints: []}}); //TODO Unfortunate but how else would I keep the waypoint order straight?
          munge_insert({lat: half_lat, lng:half_lng, order: day.order+1});
        }
      }
    } else {
      var prev_day = Days.findOne({order: day.order -1});
      if(prev_day) {
        manageTrip.insertDayAfter(prev_day, atPoint);
      }
    }
  }
  this.removeDay = function(day) {
    if(!day || !day._id) return;
    //Days.remove({_id: day._id});
    Meteor.call('days_remove', {trip_id: Session.get('trip_id'), _id: day._id});
    
    var prev_day = Days.findOne({order: day.order -1});
    var next_day = Days.findOne({order: day.order +1});
    munge_update({order: {$gte: day.order}}, {$inc : {order: -1}}, {multi: true});
    if(!prev_day) return;
    if(!next_day) {
      // This day has just become the last day, meaning it no longer gets it's own polyline
      munge_update(prev_day._id, {$set : {polyline: '', waypoints: [], distance: 0}});
    } else {
      // Try to mend the gap between days
      var new_path = myDecodePath(prev_day.polyline).concat(myDecodePath(day.polyline));
      var new_poly = myEncodePath(new_path);
      markers[prev_day._id].polyline.setPath(new_path);
      munge_update(prev_day._id, {$set: {waypoints: prev_day.waypoints.concat(day.waypoints), polyline: new_poly, distance: prev_day.distance + day.distance}});
    } 
  }
  this.updateDay = function(selector, updates, multi) {
    munge_update(selector, updates, multi);
  }
  function munge_insert(attributes) {
    attributes.created_at = Date.now();
    attributes.trip_id = Session.get('trip_id');
    //TODO best way to maintain order => Days.find().count()+1 || _.max(_.pluck(Days.find().fetch(), 'order'))+1
    attributes.order = attributes.order || Days.find().count()+1;
    attributes.waypoints = attributes.waypoints || [];
    //return Days.insert(attributes);
    var id = Days.insert(attributes);
    make_current(id);
    calc_route_with_stopover(Days.findOne(id));
    
    /*Meteor.call('days_insert', attributes, function(err, res) {
      console.log(err, res);
      add_locally(res);
      make_current(res._id);
      calc_route_with_stopover(res);
    });*/
  }
  function munge_update(selector, updates, multi) {
    if(_.isString(selector)) selector = {_id: selector};
    selector.trip_id = Session.get('trip_id');
    updates.$set = updates.$set || {};
    updates.$set.updated_at = Date.now();
    Meteor.call('days_update', selector, updates, multi);
  }
}).apply(manageTrip);
