#!/bin/bash
# Local compilation helper for Black Book LaTeX Project
# Run: ./compile_black_book.sh

cd "$(dirname "$0")/black_book" || exit 1

if ! command -v pdflatex &> /dev/null; then
    echo "=========================================================="
    echo " Error: pdflatex not found on your system."
    echo " You can upload 'Black_Book_LaTeX_Project.zip' directly to Overleaf (https://www.overleaf.com)"
    echo " Or install MacTeX locally via Homebrew: brew install --cask mactex"
    echo "=========================================================="
    exit 1
fi

echo "Compiling Black Book LaTeX Document (Pass 1: pdflatex)..."
pdflatex -interaction=nonstopmode main.tex

echo "Generating IEEE bibliography (Pass 2: bibtex)..."
bibtex main

echo "Resolving cross-references and TOC (Pass 3: pdflatex)..."
pdflatex -interaction=nonstopmode main.tex

echo "Finalizing page numbers and index (Pass 4: pdflatex)..."
pdflatex -interaction=nonstopmode main.tex

echo "=========================================================="
echo " Compilation Complete! Output: black_book/main.pdf"
echo "=========================================================="
