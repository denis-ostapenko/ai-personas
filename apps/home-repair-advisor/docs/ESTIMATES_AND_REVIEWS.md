# Estimates and reviews: methodology v0.2

Implemented October 11, 2026 at the owner's request. This is a preliminary decision aid for small household jobs, not a final quote or an inspected diagnosis.

## Cost model

1. Photo and customer facts produce a scope, total worker-hour interval, quantity basis, materials allowance, assumptions and exclusions. A photo cannot establish dimensions or concealed conditions. Unknown painting area and unscopable specialist work should trigger clarification.
2. ZIP resolves to a city/state. Discovery uses a short service phrase; the full job is retained for applicability assessment. Published rates are extracted with exact source quotations, dollar values, units and locality evidence.
3. Local project ranges take precedence over local hourly rates, then national project/hourly references. A national source is visibly labeled and confidence lowered. There is no invented city/ZIP multiplier.
4. Hourly calculation: `max(estimated worker-hours, sourced minimum hours) * published hourly rate + estimated materials`. A project rate multiplies only compatible units and stated quantities. Included materials are not charged twice. Unknown visit minimums, taxes, travel and hidden damage remain stated limitations.
5. The displayed interval rounds its lower endpoint down and upper endpoint up to $10. Line items preserve arithmetic before rounding. Starting advertisements alone cannot supply a full range. Unsupported inputs produce a specific unavailable explanation.

The model judges scope/rate applicability; code verifies quotations and numbers and performs the arithmetic. This reduces invented arithmetic, not semantic mistakes. Material allowances and effort are engineering estimates, not sourced measurements. A future calibration set should compare intervals with completed-job invoices by trade and region, measuring interval coverage and over/under-estimation.

## Review evidence

Public search plus bounded full-profile extraction targets business-specific profiles on Yelp, Thumbtack, Angi, Birdeye and Trustpilot. Category/listing search pages cannot provide a business score. A separate profile must contain the company name and match its full phone number, linked official domain, or a reverse link from the official business page. The score and count must both occur in the source quote. Platform names come from the validated domain, not model memory. A Birdeye aggregate is labeled Birdeye even when it republishes Google reviews.

One excerpt of no more than 25 words may be shown per company with its source. Author/date are shown only if supported. Missing author information is explicit. This is a retrieved sample, not a balanced summary of all customers; no sentiment score is inferred. Review counts can differ between platforms and snapshots. They are not merged.

Suggested call order favors a sourced telephone and an attributable rating. A sourced phone adds 20 ranking points and an attributable five-star-scale score adds 10. Within comparable evidence, a review-volume-adjusted value `(rating * count + 4 * 20) / (count + 20)` reduces the dominance of a single five-star review. The constants are product heuristics, not empirical quality probabilities. Platforms have different selection mechanisms; ranking is labeled a decision aid. Prices are not ranked as if unconfirmed scopes were equivalent. ZIP coverage and appointment slots still need confirmation.

## Direct Google Places adapter

The optional adapter makes one bounded Text Search (New) request for up to four businesses with name/contact/rating/count/reviews/attribution fields. Closed businesses are excluded. Available reviewer attribution and source links are displayed; relevance ordering and incomplete sample coverage are stated. Content is displayed transiently, never written to the case store or sent to OpenAI. An access error has a five-minute retry circuit breaker and no raw error body or secret is exposed.

Live access on October 11 failed with `403 PERMISSION_DENIED / API_KEY_IP_ADDRESS_BLOCKED`. The adapter is unit-tested, but a successful live Google response is NOT claimed. Existing key restrictions were preserved. Completion of this connector needs either an appropriately restricted key permitting this host or an already authorized server in its allowed IP range. This does not prevent independently sourced public review profiles from working.

Relevant official behavior and attribution requirements: [Places Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search), [Place Details](https://developers.google.com/maps/documentation/places/web-service/place-details), [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies). Before public hosting, provide the required public terms/privacy pages and complete an attribution review. This prototype remains loopback-only.
