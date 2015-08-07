/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

/* global Panel */

$('body').html(Panel.render().el);

self.port.on('panelData', function (msg) {
	Panel.model.set(msg);
	// TODO find a better place for this, needs to be run after everything is set
	// When inside the change:needsReload listener, pauseBlocking/whitelisted not set yet
	Panel.initializeStartingStates();
});
