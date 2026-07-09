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

## Temporal Filtering Semantics: Interval Overlap vs. Start-Time Containment

## The Problem

Unlike discrete log events, a satellite pass possesses temporal duration defined by an explicit start (ts_start) and end (ts_end). When a user applies a time filter window (e.g., "Show me passes between Tuesday and Wednesday"), evaluating whether a pass falls "inside" that window introduces boundary edge-cases for passes that straddle the filter limits.

For example, consider an orbital pass that begins late Monday night and concludes Tuesday morning. If a user queries a timeline window of Tuesday-to-Wednesday, a portion of that pass (the Tuesday morning tail) physically occurs within their window, while the initial segment falls outside of it. The filtering logic must deterministically handle these straddling intervals without sacrificing data integrity or misrepresenting satellite availability.

## The Decision

I chose to implement interval overlap semantics rather than simple start-time containment. A pass is included in the query results if any part of its duration intersects the requested time window [window_start, window_end].

The boolean logic to express this in DuckDB is:
WHERE ts_start <= :window_end AND ts_end >= :window_start

This condition evaluates whether the two intervals touch: the pass must begin before the queried window closes, and it must end after the queried window opens. If both conditions are met, the pass is captured.

Domain Justification (Why this is the correct choice)
In aerospace and satellite operations, an orbital pass represents a finite window of visibility, ground-station downlinking, or sensor tasking availability. If a satellite is overhead during a user's requested window, it is operationally relevant—regardless of exactly when its pass sequence initiated.

Choosing a simpler ts_start BETWEEN :start AND :end rule would introduce a critical flaw: a satellite that is actively crossing the sky when the user’s window opens would be completely hidden simply because it crossed the horizon a few minutes early. In a production tracking context, hiding an active satellite creates an inaccurate operational picture. The logic must adapt to the physical reality of the domain (continuous orbital trajectories), not what is easiest to express in a basic SQL clause.

## Rejected Alternatives

Start-Time Containment (ts_start within window): This was rejected because it treats durations as point-in-time events. While arguably simpler to express, it fails operational requirements by dropping highly relevant, boundary-straddling passes.

## Proximity Queries: Vertex-Based Great-Circle Distance vs. Linear Interpolation

## The Problem

To implement a "click-to-query" feature on the map, the API must calculate how close a satellite's track comes to a user-selected coordinate. Doing this inside our DuckDB environment presents two specific challenges:

The Coordinate Distortion Trap: Measuring distance using raw degrees (planar Cartesian math on longitude/latitude) introduces severe errors because a degree of longitude shrinks to zero as you move from the equator to the poles. Degrees are not kilometers.

Missing Geodesic Functions: The current DuckDB build lacks a native GEOGRAPHY data type and an ST_ClosestPoint function, meaning native geodesic point-to-line distance calculations are unavailable across our spatial paths.

## The Decision

I chose to evaluate proximity by calculating the true great-circle distance (ST_Distance_Sphere) from the clicked point directly to the 7 sampled vertices of each pass, converting the user-provided kilometer radius into meters.

Instead of treating the pass as a continuous line string, the SQL query treats it as a known set of coordinates. It extracts the closest vertex distance to represent the pass's proximity.

## Domain Justification & Limitations

Because this method evaluates discrete vertices rather than a continuous line path, it introduces a geometric limitation: if the satellite's true closest approach happens exactly halfway between two vertices, the algorithm will overestimate the distance. Given our uniform ~70km vertex spacing, the spatial error is an estimate of scale, approximately half the vertex spacing, on the order of ~35km.

However, in a satellite operations context, this error profile works in our favor because it errs toward false negatives, never false positives. It might occasionally exclude a marginal pass that barely skimmed the outer boundary of the radius, but it will never invent an artificial pass that didn't occur. For a tracking and tasking tool, dropping a borderline edge case is a safe operational failure mode; fabricating a fake satellite pass is a destructive one.

## Rejected Alternatives

Densified Linear Interpolation: We attempted to patch the vertex spacing gap by injecting interpolated points along the line string to create a dense path. This was rejected because interpolating raw, unprojected longitude/latitude coordinates lacks antimeridian awareness. When a satellite crosses the International Date Line, a naive interpolation algorithm draws a bogus straight path backward across the entire globe to connect the coordinates. This error manufactures massive false positives—calculating a proximity of 293km for a satellite that was physically 13,807km away on the other side of the planet. True point-to-line calculation requires heavy antimeridian-aware splitting or custom user-defined functions (UDFs), which are reserved for the next architectural iteration.
