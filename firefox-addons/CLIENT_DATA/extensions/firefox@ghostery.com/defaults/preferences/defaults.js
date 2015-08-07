     
# RRZN-Voreinstellungen, 20120416-HH
# Nicht anzeigen, was alles blockiert wird (Anzahl Sites erscheint trotzdem):
pref('extensions.ghostery.showBubble', false);
pref("extensions.ghostery.blockingMode", 0);
# Clean-Up von Flash-/Silverlight-Cookies:
pref('extensions.ghostery.enableCleanup', true);
pref("extensions.ghostery.cookieProtect", true);
pref("extensions.ghostery.whitelist", "uni-hannover.de");
# Tutorial ueberspringen, da bereits durchlaufen:
pref('extensions.ghostery.tutorial', true);
# nach Updates neue Dinge blockieren
pref("extensions.ghostery.updateBlockBehaviour", true);
