var Ghostery = Ghostery || {},
	win = window,
	doc = win.document,
	C2P_HTML;

function id() {
	var s = '';
	while (s.length < 32) {
		s += Math.random().toString(36).replace(/[^A-Za-z]/g, '');
	}
	return s;
}

function createEl(type) {
	return doc.createElement(type);
}

// arguments: parentElement, *childElements
function appendChild(parent) {
	for (var i = 1; i < arguments.length; i++) {
		parent.appendChild(arguments[i]);
	}
}

function getSource(el) {
	if (!el) { return undefined; }

	if (el.nodeName == 'OBJECT') {
		return el.src || el.data || undefined;
	} else if (el.src.indexOf('data:') === 0) {
		return undefined;
	}
	
	return el.src;
}

function isAboveFold(el) {
	if (el.nodeName == 'SCRIPT') {
		return -1;
	}
	// TODO FF: iframes should be handled this way. However, for some reason this throws 'Permission denied to access property 'getBoundingClientRect''
//	if (window.frameElement)
//		el = window.frameElement;
	try {
		if (el.getBoundingClientRect().top > 0) {
			return +(window.top.document.defaultView.innerHeight > (el.getBoundingClientRect().top + (el.offsetHeight * 0.6)));
		} else {
			return -1;
		}
	} catch (e) { return -1; }
}

function scanDOMForBugs() {
	var selectors =
			'script' +
			((Ghostery.conf.block_images) ? ',img' : '') +
			((Ghostery.conf.block_frames) ? ',iframe' : '') +
			((Ghostery.conf.block_objects) ? ',embed,object' : ''),
		h = (document.location ? (document.location.protocol +  '//' +  document.location.host) : ''),
		isFrame = !!window.frameElement,
		uniq = {},
		i;

	Ghostery.els = document.querySelectorAll(selectors);

	for (i = 0; i < Ghostery.els.length; i++) {
		var src = getSource(Ghostery.els[i]);

		// if the element source has been already scanned, skip.
		// TODO: this requires some thought 
		//  - what does this break?
		//  - are we going to be missing information?
		if (uniq.hasOwnProperty(src)) { continue; }

		if (!src) { continue; }

		if (Ghostery.els[i].nodeName == 'IMG' && !isFrame && (src.indexOf(h) === 0)) {
			continue;
		}

		self.port.emit('isBug', {
			src: src,
			index: i,
			af: isAboveFold(Ghostery.els[i])
		});

		uniq[src] = i;
	}
}

function buildC2P(c2pFrame, c2pAppDef) {
	c2pFrame.addEventListener('load', function () {

		var idoc = c2pFrame.contentDocument,
			frame_id = c2pFrame.id;

		idoc.documentElement.innerHTML = C2P_HTML;

		if (c2pAppDef.button) {
			c2pFrame.style.width = '30px';
			c2pFrame.style.height = '19px';
			c2pFrame.style.border = '0px';
		} else {
			c2pFrame.style.width = '100%';
			c2pFrame.style.border = '1px solid #ccc';
			c2pFrame.style.height = '80px';
		}

		if (c2pAppDef.frameColor) {
			c2pFrame.style.background = c2pAppDef.frameColor;
		}

		self.port.emit('c2pToolTip', {
			bug: c2pAppDef,
			c2pFrameId: frame_id
		});

		if (c2pAppDef.button) {
			idoc.getElementById('text').style.display = 'none';
			idoc.getElementById('ghosty_block').style.display = 'none';
			idoc.getElementById('action_always').style.display = 'none';
			idoc.getElementById('action_once').firstChild.src = 'resource://firefox-at-ghostery-dot-com/ghostery/data/images/click2play/' + c2pAppDef.button;

			idoc.getElementById('action_once').addEventListener('click', function (e) {
				// TODO check if we have a security issue: can a page mess
				// with this C2P frame/dispatch messages that looks like
				// our messages to our background page?
				self.port.emit('processC2P', {
					action: 'once',
					bug: c2pAppDef,
					c2pFrameId: frame_id
				});

				e.preventDefault();
			}, true);

		} else {
			idoc.getElementById('action_once').addEventListener('click', function (e) {
				self.port.emit('processC2P', {
					action: 'once',
					bug: c2pAppDef,
					c2pFrameId: frame_id
				});

				e.preventDefault();
			}, true);

			idoc.getElementById('action_always').addEventListener('click', function (e) {
				self.port.emit('processC2P', {
					action: 'always',
					bug: c2pAppDef,
					c2pFrameId: frame_id
				});

				e.preventDefault();
			}, true);
		}
	}, false);
}

function applyClickToPlay(c2pData) {
	var el,
		els,
		c2pApp = [],
		c2pAppDef = {};

	for (var key in c2pData) {
		c2pApp = c2pData[key];

		for (var i = 0; i < c2pApp.length; i++) {
			c2pAppDef = c2pApp[i];

			els = doc.querySelectorAll(c2pAppDef.ele);
			// TODO remove console.logs
			// console.log(" SEARCHING FOR " + c2pAppDef.ele);
			// console.log(els);

			for (var j = 0; j < els.length; j++) {
				el = els[j];

				if (c2pAppDef.attach && c2pAppDef.attach == 'parentNode') {
					if ((el.parentNode) && (el.parentNode.nodeName != 'BODY') && (el.parentNode.nodeName != 'HEAD')) {
						var div = createEl('div');
						el.parentNode.replaceChild(div, el);
						el = div;
					}
				}

				var c2pFrame = createEl('iframe');

				c2pFrame.id = id();

				if (c2pAppDef.attach != 'parentNode') {
					el.textContent = '';
				}

				el.style.display = 'block';

				buildC2P(c2pFrame, c2pAppDef);

				appendChild(el, c2pFrame);
			}
		}
	}
}

function c2pToolTip(msg) {
	var iframe = doc.getElementById(msg.c2pFrameId),
		idoc;

	if (iframe) {
		var content = iframe.contentWindow || iframe.contentDocument;

		if (content) {
			idoc = content.document || content.documentElement;
		}
	}

	if (!idoc) {
		return;
	}

	if (msg.bug.button) {
		idoc.getElementById('action_once').firstChild.setAttribute('title', msg.tooltip.action_once);
	} else {
		idoc.getElementById('ghosty_block').setAttribute('title', msg.tooltip.ghosty_block);
		if (msg.tooltip.text) {
			idoc.getElementById('text').style.display = '';
			idoc.getElementById('text').textContent = msg.tooltip.text;
		}
	}
}

self.port.on('scanDOM', function (msg) {
	Ghostery.l10n = msg.l10n;
	Ghostery.conf = msg.conf;
	Ghostery.site = msg.site;
	Ghostery.html = msg.html;
	Ghostery.MOBILE_MODE = msg.MOBILE_MODE;

	// NOTE this is a necessary hack to correctly update the tab_url of a newly open tab on Android
	// Its counterpart is located on lib/background.js
	if (Ghostery.MOBILE_MODE && !win.frameElement && win.location) {
		self.port.emit('updateTabInfo', { tab_url: win.location.href });
	}

	// this is going to remain invisible for a while.
	if (Ghostery.conf.dom_scanner) {
		scanDOMForBugs();
	}

	if (!win.frameElement) {
		self.port.emit('pageLoaded');
	}
});

self.port.on('removeBug', function (msg) {
	var index = msg.index;
	if (Ghostery.els[index].parentNode) {
		Ghostery.els[index].parentNode.removeChild(Ghostery.els[index]);
	}
});

self.port.on('c2p', function (msg) {
	applyClickToPlay(msg.c2pData);
});
self.port.on('c2pToolTip', function (msg) {
	c2pToolTip(msg);
});
self.port.on('c2pFrameHtml', function (msg) {
	C2P_HTML = msg.html;
});
