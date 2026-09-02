Simulate 500 examples with a global max execution time of 6 hours, each example
will simulate 300s elapsed inside simulation which can take less or more than that in real time:

For example a simulation that happened to establish num of particles to 500 aprox, will be very easy to simulate and cant take too much time for example: 300 s simulated in 5seconds.

If there are too many particles (2000) in case you are using too a Raspberry pI 5 
is probable that simulation goes up to even 1000seconds or more.... There is a param
inside the script called ...SEC_MAX... I recomend to put it down to 2000 but can skip simulations that could be successfull.... so..... Good Luck!

node batch-simulate.mjs --mode random --all-params --samples 500 --hours 6 --seconds-per-run 300 --out ./dataset-A



node batch-simulate.mjs --mode random --all-params --samples 500 --hours 6 --seconds-per-run 300 --out ./dataset-B
node batch-simulate.mjs --mode random --all-params --samples 500 --hours 6 --seconds-per-run 300 --out ./dataset-C
node batch-simulate.mjs --mode random --all-params --samples 500 --hours 6 --seconds-per-run 300 --out ./dataset-D

node batch-simulate.mjs --mode random --all-params --samples 500 --hours 6 --seconds-per-run 300 --out ./dataset-X
node batch-simulate.mjs --mode random --all-params --samples 500 --hours 6 --seconds-per-run 300 --out ./dataset-Y
node batch-simulate.mjs --mode random --all-params --samples 500 --hours 6 --seconds-per-run 300 --out ./dataset-Z

