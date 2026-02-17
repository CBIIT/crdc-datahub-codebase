#!/bin/sh

CODE_FOLDER=$PWD
cd tests || exit
export PYTHONPATH=$PYTHONPATH:$CODE_FOLDER
python3 -m unittest
