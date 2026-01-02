.PHONY: run install clean

install:
	poetry install

run:
	poetry run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +