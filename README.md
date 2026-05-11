# SUBSIDENCE

A local desktop application for 1D burial history analysis and tectonic subsidence / backstripping of sedimentary basins.

Runs as a local web application: the backend serves data and calculations, and the browser is the UI. No cloud, no account, no data leaves your machine.

---

## What it does

- Import well data: LAS log curves, formation tops (CSV), deviation surveys.
- Visualise well logs in a depth-track viewer with curve fills and lithology columns.
- Build stratigraphic frameworks: shared marker sets (TopSets) and regional stratigraphic charts.
- Assign lithology zones and compaction model parameters per zone.
- Run **1D backstripping** per well and view tectonic subsidence, total subsidence, water depth, and burial curves through geological time.
- Compare results across multiple wells on a shared time axis.

The project state is stored as a `.subsidence` folder on disk — a SQLite database plus Parquet files for log curves and JSON files for computed results.

---

## Scientific basis

The backstripping and decompaction methodology follows:

- **pyBacktrack** — Müller et al. (2018), EarthByte.  
  Reconstructs paleo-water depth through tectonic subsidence modelling and decompaction.  
  [doi:10.1029/2017GC007313](https://doi.org/10.1029/2017GC007313) · [docs](http://pybacktrack.readthedocs.io/)

- **PyBasin** — Luijendijk et al. (2011), University of Bergen.  
  Burial history, compaction, and thermal modelling.  
  [doi:10.1029/2010JB008071](https://doi.org/10.1029/2010JB008071) · [Zenodo](https://doi.org/10.5281/zenodo.4263427)

- **py_lopatin** — burial history reconstruction from formation age and thickness data.

- **Stratya2D** — Harikrishnan Nalina Kumar.  
  2D kinematic decompaction and backstripping methodology.  
  [GitHub](https://github.com/harikrishnannalinakumar/Stratya2D)

Sea level curves included: Haq composite, Van der Meer et al. (2017), Kocsis & Scotese (2020), Verard (2015).

Lithology SVG patterns from the [Equinor lithology-patterns](https://github.com/equinor/lithology-patterns) library (MIT).

Reference implementations are in `repos/`.

---

## How to run

**Backend** (terminal 1):

```powershell
cd d:\github\subsidence
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH = "d:\github\subsidence\app\src"
python -m uvicorn subsidence.api.main:app --host 127.0.0.1 --port 8000
```

**Frontend** (terminal 2):

```powershell
cd d:\github\subsidence\frontend
npm run dev -- --host 127.0.0.1
```

Open **http://127.0.0.1:5173** in a browser.

---

## How it works

1. **Create or open a project** — a `.subsidence` folder on disk.
2. **Import data** — LAS log files, formation tops CSV, deviation surveys.
3. **Build a stratigraphic framework** — create a TopSet with named horizon markers and link it to a regional stratigraphic chart.
4. **Configure zones** — assign lithology fractions and compaction model parameters to each stratigraphic zone.
5. **Run backstripping** — the backend decompacts each zone, removes water and sediment load, and reconstructs tectonic subsidence through time.
6. **Explore results** — view burial and subsidence curves per well or compare across wells on a shared age axis.

---

## Documentation

- [Architecture overview](docs/architecture.md)
- [Codebase map — where to look by bug type](docs/codebase-map.md)
- [Documentation index](docs/documentation-index.md)
