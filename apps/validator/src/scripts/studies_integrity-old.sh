while IFS= read -r line; do
    python -m src.scripts.file_integrity --old "$line"
done < tmp/studies.txt
