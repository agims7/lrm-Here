(function() {
	'use strict';

	var L = require('leaflet');
	var corslite = require('corslite');

	L.Routing = L.Routing || {};

	L.Routing.Here = L.Class.extend({
		options: {
			serviceUrl: 'https://route.cit.api.here.com/routing/7.2/calculateroute.json',
			timeout: 30 * 1000,
			urlParameters: {}
		},

		initialize: function(appId, appCode, options) {
			this._appId = appId;
			this._appCode = appCode;
			L.Util.setOptions(this, options);
		},

		route: function(waypoints, callback, context, options) {
			var timedOut = false,
				wps = [],
				url,
				timer,
				wp,
				i;

			options = options || {};
			url = this.buildRouteUrl(waypoints, options);

			timer = setTimeout(function() {
								timedOut = true;
								callback.call(context || callback, {
									status: -1,
									message: 'Here request timed out.'
								});
							}, this.options.timeout);

			// Create a copy of the waypoints, since they
			// might otherwise be asynchronously modified while
			// the request is being processed.
			for (i = 0; i < waypoints.length; i++) {
				wp = waypoints[i];
				wps.push({
					latLng: wp.latLng,
					name: wp.name,
					options: wp.options
				});
			}

			corslite(url, L.bind(function(err, resp) {
				var data;

				clearTimeout(timer);
				if (!timedOut) {
					if (!err) {
						data = JSON.parse(resp.responseText);
						this._routeDone(data, wps, callback, context);
					} else {
						callback.call(context || callback, {
							status: -1,
							message: 'HTTP request failed: ' + err
						});
					}
				}
			}, this));

			return this;
		},

		_routeDone: function(response, inputWaypoints, callback, context) {
			var alts = [],
			    mappedWaypoints,
			    coordinates,
			    i, j, k,
			    instructions,
			    distance,
			    time,
			    leg,
			    maneuver,
			    path;

			context = context || callback;
			if (!response.response.route) {
				callback.call(context, {
					// TODO: include all errors
					status: response.type,
					message: response.details
				});
				return;
			}

			for (i = 0; i < response.response.route.length; i++) {
				path = response.response.route[i];
				coordinates = this._decodeGeomertry(path.shape);
	//			mappedWaypoints =
	//				this._mapWaypointIndices(inputWaypoints, path.instructions, coordinates);

				instructions = [];
				time = 0;
				distance = 0;
				for(j = 0; j < path.leg.length; j++) {
					leg = path.leg[j];
					for(k = 0; k < leg.maneuver.length; k++) {
						maneuver = leg.maneuver[k];
						distance += maneuver.length;
						time += maneuver.travelTime;
						instructions.push(this._convertInstruction(maneuver));
					}
				}

				alts.push({
					name: '',
					coordinates: coordinates,
					instructions: instructions,
					summary: {
						totalDistance: distance,
						totalTime: time,
					},
					inputWaypoints: inputWaypoints
					// actualWaypoints: mappedWaypoints.waypoints,
					// waypointIndices: mappedWaypoints.waypointIndices
				});
			}

			callback.call(context, null, alts);
		},

		_decodeGeomertry: function(geometry) {
			var latlngs = new Array(geometry.length),
				coord,
				i;
			for (i = 0; i < geometry.length; i++) {
				coord = geometry[i].split(",");
				latlngs[i] = new L.LatLng(coord[0], coord[1]);
			}

			return latlngs;
		},

		buildRouteUrl: function(waypoints, options) {
			var locs = [],
				i,
				baseUrl;
			
			for (i = 0; i < waypoints.length; i++) {
				locs.push('waypoint' + i + '=geo!' + waypoints[i].latLng.lat + ',' + waypoints[i].latLng.lng);
			}

			baseUrl = this.options.serviceUrl + '?' + locs.join('&');

			return baseUrl + L.Util.getParamString(L.extend({
					instructionFormat: 'text',
					app_code: this._appCode,
					app_id: this._appId,
					representation: "navigation",
					mode: 'fastest;car',
					alternatives: 5
				}, this.options.urlParameters), baseUrl);
		},

		_convertInstruction: function(instruction) {
			return {
				text: instruction.instruction,//text,
				distance: instruction.length,
				time: instruction.travelTime
				/*
				type: instruction.action,
				road: instruction.roadName,
				*/
			};
		},

	});
	
	L.Routing.here = function(appId, appCode, options) {
		return new L.Routing.Here(appId, appCode, options);
	};

	module.exports = L.Routing.Here;
})();
