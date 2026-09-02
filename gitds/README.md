Decompress this file where you want using the ZipUnZipMerge.py 
utility or manually.

The merge.zip contains all runs from all my simulations.

That data is needed for training the model, if You want to generate more data 
read REadme to launch commands that generate "run..." files and then you can put them into the uncompressed merge folder.

But the reason I use a script like "mergeDatasets.py" is that each dataset (If you for example run 4 command at the same time with different target dir to not overwrite run files between them), there will be 4 files named run-0001.json... So mergeDatasets.py just gets all run files from the array inside the code telling where to look for that files and assings a number n+1.

