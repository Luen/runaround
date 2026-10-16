<script lang="ts">
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';
	import { resolve } from '$app/paths';
	import { outdoorsStyle, WANDERSTORIES_ATTRIBUTION } from '$lib/basemaps';
	import { GeoJSONSource, Map, Marker, NavigationControl } from '$lib/maplibre';
	import { joinLegs, lineDistanceM, type Coord } from '$lib/routing';

	let { routingAvailable, name = 'drawnCourse' }: { routingAvailable: boolean; name?: string } =
		$props();

	type Snapshot = { waypoints: Coord[]; legs: Coord[][] };

	let container: HTMLDivElement;
	let map: Map | null = null;
	let markers: Marker[] = [];

	let waypoints = $state<Coord[]>([]);
	let legs = $state<Coord[][]>([]);
	let history = $state<Snapshot[]>([]);
	// svelte-ignore state_referenced_locally
	let snap = $state(routingAvailable);
	let pending = $state(0);
	let routeError = $state('');

	const line = $derived(joinLegs(legs));
	const distanceKm = $derived(lineDistanceM(line) / 1000);
	const courseValue = $derived(
		line.length >= 2 ? JSON.stringify({ type: 'LineString', coordinates: line }) : ''
	);

	function clone<T>(v: T): T {
		return JSON.parse(JSON.stringify(v)) as T;
	}

	function remember() {
		history = [...history, clone({ waypoints, legs })];
	}

	async function fetchLeg(from: Coord, to: Coord): Promise<Coord[]> {
		if (!snap) return [from, to];
		pending += 1;
		try {
			const res = await fetch(resolve('/admin/route'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ from, to })
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const body = (await res.json()) as { coordinates: Coord[]; snapped: boolean; error?: string };
			routeError = body.snapped ? '' : `Straight line used: ${body.error ?? 'no path found'}`;
			return body.coordinates;
		} catch (err) {
			routeError = `Straight line used: ${err instanceof Error ? err.message : 'routing failed'}`;
			return [from, to];
		} finally {
			pending -= 1;
		}
	}

	async function addWaypoint(c: Coord) {
		remember();
		const prev = waypoints.at(-1);
		waypoints = [...waypoints, c];
		if (prev) {
			const leg = await fetchLeg(prev, c);
			legs = [...legs, leg];
		}
	}

	async function moveWaypoint(i: number, c: Coord) {
		remember();
		const next = [...waypoints];
		next[i] = c;
		waypoints = next;
		const updated = [...legs];
		const jobs: Promise<void>[] = [];
		if (i > 0) jobs.push(fetchLeg(next[i - 1], c).then((leg) => void (updated[i - 1] = leg)));
		if (i < next.length - 1)
			jobs.push(fetchLeg(c, next[i + 1]).then((leg) => void (updated[i] = leg)));
		await Promise.all(jobs);
		legs = updated;
	}

	function undo() {
		const last = history.at(-1);
		if (!last) return;
		history = history.slice(0, -1);
		waypoints = last.waypoints;
		legs = last.legs;
	}

	function clearAll() {
		if (waypoints.length === 0) return;
		remember();
		waypoints = [];
		legs = [];
	}

	function syncMarkers() {
		if (!map) return;
		for (const m of markers) m.remove();
		markers = waypoints.map((c, i) => {
			const el = document.createElement('div');
			el.className =
				'flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow';
			el.style.background =
				i === 0 ? '#15803d' : i === waypoints.length - 1 ? '#b91c1c' : '#ea580c';
			el.textContent = String(i + 1);
			el.title = 'Drag to move';
			const marker = new Marker({ element: el, draggable: true }).setLngLat(c).addTo(map!);
			marker.on('dragend', () => {
				const ll = marker.getLngLat();
				void moveWaypoint(i, [ll.lng, ll.lat]);
			});
			return marker;
		});
	}

	function syncLine() {
		const source = map?.getSource('drawn') as GeoJSONSource | undefined;
		source?.setData({
			type: 'FeatureCollection',
			features:
				line.length >= 2
					? [
							{
								type: 'Feature',
								properties: {},
								geometry: { type: 'LineString', coordinates: clone(line) }
							}
						]
					: []
		});
		map?.triggerRepaint();
	}

	$effect(() => {
		void waypoints;
		syncMarkers();
	});

	$effect(() => {
		void line;
		syncLine();
	});

	onMount(() => {
		const key = env.PUBLIC_MAPTILER_API_KEY?.trim() || null;
		map = new Map({
			container,
			style: outdoorsStyle(key),
			center: [146.8, -19.26],
			zoom: 12,
			attributionControl: { customAttribution: key ? WANDERSTORIES_ATTRIBUTION : undefined }
		});
		map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
		map.getCanvas().style.cursor = 'crosshair';
		map.on('load', () => {
			map!.addSource('drawn', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});
			map!.addLayer({
				id: 'drawn-casing',
				type: 'line',
				source: 'drawn',
				paint: { 'line-color': '#fff7ed', 'line-width': 7 },
				layout: { 'line-join': 'round', 'line-cap': 'round' }
			});
			map!.addLayer({
				id: 'drawn-line',
				type: 'line',
				source: 'drawn',
				paint: { 'line-color': '#ea580c', 'line-width': 4 },
				layout: { 'line-join': 'round', 'line-cap': 'round' }
			});
			syncLine();
		});
		map.on('click', (e) => void addWaypoint([e.lngLat.lng, e.lngLat.lat]));
		return () => {
			for (const m of markers) m.remove();
			map?.remove();
			map = null;
		};
	});
</script>

<div class="space-y-2">
	<div class="flex flex-wrap items-center gap-3 text-sm">
		<span class="font-semibold" aria-live="polite">{distanceKm.toFixed(2)} km</span>
		<span class="text-stone-500">{waypoints.length} point{waypoints.length === 1 ? '' : 's'}</span>
		<label
			class="flex items-center gap-1"
			title={routingAvailable ? '' : 'Set ROUTING_PROVIDER to enable'}
		>
			<input type="checkbox" bind:checked={snap} disabled={!routingAvailable} />
			Snap new segments to paths
		</label>
		<button
			type="button"
			class="rounded-full border px-3 py-1 disabled:opacity-50"
			onclick={undo}
			disabled={history.length === 0 || pending > 0}>Undo</button
		>
		<button
			type="button"
			class="rounded-full border px-3 py-1 disabled:opacity-50"
			onclick={clearAll}
			disabled={waypoints.length === 0 || pending > 0}>Clear</button
		>
		{#if pending > 0}<span class="text-stone-500">Routing…</span>{/if}
	</div>
	<div bind:this={container} class="h-[28rem] w-full overflow-hidden rounded-xl border"></div>
	<p class="text-xs text-stone-500">
		Click the map to add points in order (start → finish). Drag a numbered point to adjust it; the
		segments either side are re-routed.
		{#if !routingAvailable}Path snapping is not configured, so segments are straight lines.{/if}
	</p>
	{#if routeError}<p class="text-sm text-amber-700">{routeError}</p>{/if}
	<input type="hidden" {name} value={courseValue} />
</div>
