# components/loads/

The electrical component library palette: drag an item onto the canvas
or click to arm click-to-place. Item definitions (type, VA, continuous,
default-voltage rules) live in `lib/component-library.ts` — add new
catalog entries there, not here; the palette renders whatever the
library exports. Firm-tier custom component libraries will extend that
same data source.
