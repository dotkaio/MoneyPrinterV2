# Legacy Python implementation

This directory preserves the Python 3.12 MoneyPrinterV2 application as it existed before the TypeScript rebuild. It is retained for migration review and emergency rollback; new features and fixes belong in the repository-root TypeScript application.

The code still assumes its own directory is the project root. To run it, change into `legacy/python`, create a virtual environment, install `requirements.txt`, copy its `config.example.json`, restore a backup of the old cache at `legacy/python/.mp`, and run `python src/main.py`. Do not run the Python scheduler concurrently with the TypeScript worker against the same publishing accounts.
