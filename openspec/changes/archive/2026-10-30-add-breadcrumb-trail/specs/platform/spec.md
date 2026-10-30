# platform — delta

## ADDED Requirements

### Requirement: Breadcrumb trail across apps
The UI SHALL show the pages the user followed links through as clickable crumbs above the page. Visiting a
page already on the trail SHALL cut the trail back to it; a record pager step or a post-save redirect SHALL
replace the last crumb; a sidebar item, the dashboard, "Yangi loyiha" or a typed URL SHALL start a new
trail. Record crumbs show the record's code; list crumbs keep their filters.

#### Scenario: Back to the order from the payment
- WHEN the user opens XB-00001, then its money request PS-00001, then the RKO that paid it
- THEN the trail reads "XB-00001 › PS-00001 › RKO-00001", and clicking "XB-00001" opens the order with a
  trail of one crumb

#### Scenario: Sidebar starts over
- WHEN the user clicks "Kassa va bank" in the sidebar from deep in a trail
- THEN the trail is only "Kassa va bank"
