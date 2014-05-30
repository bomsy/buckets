/*
	A simple event based system for building 
	single pages apps.
*/
(function(root, undefined){
	"use strict"
	var previousBuckets = root.Buckets;
	var Buckets;

	root.Buckets = Buckets = {};

	var topics = {};
	var queue = []; // Queue to handle notify requests


  var _mixin = function(dest, source, exclude){
    for(var prop in source){
      if(source.hasOwnProperty(prop))
        dest[prop] = source[prop];  
    }
    return dest;
  };

	var _subscribe = function(topic, cnxt, func){
		if(!topics[topic]){
			topics[topic] = [];
		}
		topics[topic].push({
			context: cnxt,
			func: func
		});
	};

	var _unsubscribe = function(){

	};

	var _publish = function(topic, args){
		var t = topics[topic];
		if(!t){ 
			return false; 
		}
		for(var i = 0, l = t.length; i < l; i++){
			if(typeof t[i].func === "function") {
				t[i].func.call(t[i].context, args);
			}
		}
	};

	// Represent actions used to manipulate views
	var eventsMap = {
		'onRender': 'render',
		'onInitialize': 'initialize',
	    'beforeRender': 'beforeRender',
	    'beforeInitialize': 'beforeInitialize'
	};
		
	var _bindEvents = function(events, o){
		for (var evt in events) {
			var cache;
			if(typeof events[evt] !== 'function'){
				return;
			}

			if (eventsMap[evt]) {
				cache = o[eventsMap[evt]];
				o[eventsMap[evt]] = function() {
					if (typeof cache === "function") {
						cache.apply(o, arguments);
					}
					events[evt].call(o)
				};
			} else {
				o.el.addEventListener(evt.slice(2).toLowerCase(), events[evt], false);
			}
		}
	};


	// Equivalent to Views in the MVC architecture
	var View = Buckets.View = function(options){
		_mixin(this, options);
		this.name = this.name || '';
		this.bucket = null;
		this.events = this.events || [];
		// instance should define
		this.render = this.render || null;
		this.initialize = this.initialize || function() {};
		// Load 

		this.init();
	};

	View.prototype.init = function() {
		_bindEvents(this.events, this);
		this.initialize();
		if(typeof this.render === 'function') 
      		this.render([]);
	};


	// Equivalent to Models in the MVC architecture
	var Bucket = Buckets.Bucket = function(options) {
		this.items = options.items || [];
		this.name = options.name || '';
		this._instanceName = 'Instance' + (++Bucket.instance);

		this.init();
	};

	Bucket.instance = 0;

	Bucket.eventTypes = {
		'ADDED': 'added',
		'REMOVED': 'removed',
		'UPDATED': 'updated',
		'REFRESHED': 'refreshed'
	};

	//

	Bucket.prototype.init = function() {
		this.indexAll(this.items);
	};

	Bucket.prototype.trigger = function(event, data) {
		_publish(event, data);
	};

	Bucket.prototype.on = function(event, callback) {
		if (Bucket.eventTypes[event]) {
			_subscribe(Bucket.eventTypes[event], this, callback);
		}
	};

	Bucket.prototype.raw = function(items, cond) {
		var that = this;
		items = items || this.items;
		return items.filter(function(item, i) {
			if (typeof cond == "function") {
				if(cond(item)) {
					return item.data;
				}
			} else {
				return item.data;
			}
		});
	};

	Bucket.prototype.off = function(){

	};

	// Attach meta information for all the data
	Bucket.prototype.indexAll = function(items){
		var that = this;
		this.items = items.map(function(item, i) {
			return that.index(item, i);
		});
	};

	// Attach meta information to the data
	Bucket.prototype.index = function(item, value){
		return { 
			index: value,
			data: item
		}
	};

	// ----------------- DATA MANIPULATIONS METHODS -----------------
	Bucket.prototype.update = function(func){
		for (var i = 0, l = this.items.length; i < l; i++) {
			if (typeof func === 'function') {
				func(this.items[i].data, i);
			}
		}
		console.log(this.items);
		this.notify(Bucket.eventTypes.UPDATED);
	};

	Bucket.prototype.refresh = function(items, noIndex){
		this.items = items || this.items;
		if (!noIndex) {
			this.indexAll(this.items);
		}
		this.notify(Bucket.eventTypes.REFRESHED);
	};

	// Add a new item to the bucket
	Bucket.prototype.add = function(item){
		this.items.push(this.index(item, this.items.length));
		this.notify(Bucket.eventTypes.ADDED);
	};

	// Remove an item from the bucket
	Bucket.prototype.remove = function(criteria) {
	    if (typeof criteria === "undefined") {
	      this.items = [];
	    } else {
			  for (var i = 0, l = this.items.length; i < l; i++) {
				  if (typeof criteria === 'function') {
					  if (criteria(this.items[i], i)) {
						  this.items.splice(i, 1);
						  break;
					  }
				  }
			  }
	    }
		this.notify(Bucket.eventTypes.REMOVED);
	};

	// ----------------------------------------------------

	Bucket.prototype.find = function(criteria) {
		for (var i = 0, l = this.items.length; i < l; i++) {
			if (typeof criteria === 'function') {
				if (criteria(this.items[i], i)) {
					return true;
				}
			}
		}
		return false;
	};

	Bucket.prototype.findItem = function(criteria) {
		for (var i = 0, l = this.items.length; i < l; i++) {
			if(typeof criteria === 'function') {
				if (criteria(this.items[i], i)) {
					return this.items[i]
				}
			}
		}
		return null;
	};
	
	// Fetch data from a external source using ajax
	Bucket.prototype.fetch = function(url, params){
		this.ajax(url, params, this.refresh);
	};

	Bucket.prototype.ajax = function(url, params, callback) {
		var that = this;
		AjaxRequest.get({
			url: url, 
			parameters: params || {},
			onSuccess: function(req) {
				if (req.responseText) {
					if (typeof callback === "function") {
						callback.call(that, JSON.parse(req.responseText));
					}
				}
			},
			onError: function(req) {
				if (console) {
					console.log('Error fetching data: ' + req.responseText);
				}
			}
		});
	}

	// Notify linked views of changes to the bucket
	Bucket.prototype.notify = function(eventType) {
		var e = {
			type: eventType,
			data: this.items
		};
		//console.log(this.items)
		_publish(this._instanceName, this.items);
	};

	// link Views or normal functions
	Bucket.prototype.bind = function(view, context){
		var func, contxt;
		if ( typeof view  === 'function') {
			func = view;
			contxt = context;
		} else {
			view.bucket = this;
			func = view.render;
			contxt = view;
			
		}
		_subscribe(this._instanceName, contxt, func);

		this.notify();
	};


	// Export javascript to JSON
	Bucket.prototype.toJSON = function() {
		return JSON.stringify(this.raw(this.items));
	}

})(window, undefined);
