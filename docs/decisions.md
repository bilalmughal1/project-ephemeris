## Geometry Construction: Direct Coordinate Parsing via ST_MakeLine

## The Problem

The dataset contains a structural anomaly: 1,134 out of 100,810 features are labeled as MultiLineString, but their coordinates are structured as a flat array of positions (Position[]) instead of the nested array of arrays (Position[][]) required by the GeoJSON specification.

Because they are short one nesting level, they are functionally just mislabeled LineStrings. Relying on native GeoJSON parsing via ST_GeomFromGeoJSON would cause the ingest pipeline to throw errors or misrender on those 1,134 rows, as the parser expects the coordinate nesting depth to strictly match the declared MultiLineString type metadata.

## The Decision

I verified that all 100,810 features—mislabeled or not—share an identical underlying structure: a flat list of exactly 7 [lon, lat, alt] positions.

Because the coordinate array layout is perfectly uniform and only the type string is unreliable, I bypass the type metadata entirely. The pipeline extracts the raw coordinate array directly and builds the geometry using ST_MakeLine (and ST_Point). This approach yields several practical advantages:

No Branching: Processes every single row through a single, clean code path without needing per-feature conditional checks to patch the type string.

Streamlined Parsing Logic: Bypassing a full GeoJSON schema validation step simplifies the ingestion path. While this hasn't been strictly benchmarked against DuckDB's native parser performance, it avoids forcing the engine to evaluate complex multi-geometry specs on malformed data.

Map Optimization: Drops the altitude ordinate during construction, outputting clean 2D geometries perfectly suited for map rendering and planar radius queries.

## Rejected Alternatives

Repairing labels upstream: We could run a pre-processing step to rewrite the 1,134 MultiLineString tags to LineString before handing them to ST_GeomFromGeoJSON. While this works, it adds an unnecessary normalization pass and continues to trust a metadata field that has already proven unreliable. Building directly from the source coordinates eliminates the dependency entirely instead of patching it.

## Current Limitations

This pipeline assumes the 7-point flat structure remains constant across the entire dataset. While verified for this specific telemetry file, it represents a strict constraint on the input format rather than an adaptable, general-purpose GeoJSON parser. A production-ready ingestion engine handling arbitrary third-party inputs would require true, type-aware parsing.
