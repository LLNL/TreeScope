### Open issues / To-do list for TreeScope v1.0

- **Proper handling of window resizing**: The size of the summary plots are determined when the tool is initialized. If the browser is resized after the tool has been loaded, the summary plots still maintain the original size, and are not resized properly. Please use a temporary work-around by reloading the data after choosing the desired window size.

- **Colormaps**: TreeScope offers different types (single hue vs/ diverging) and numbers (1/2/3/4) of colors maps, however, this choice is not exposed through the UI. Temporary work around for changing the default choice can be made through small code modification: see src/modules/fattree.js lines 45 and 49.

- **Active routing table**: TreeScope offers support for dynamic routing tables though selecting the active routing table. For current experiments and testing, this choice was disabled in the code, and should be re-enabled if needed. See src/modules/routing.js for *"TODO"*,

- **Counter type**: TreeScope supports different network counters through UI selection. This choice is also currently only partially enabled, and only the counter "data_sent" is used in the tool. A proper value accessor is to be implemented to fully support all variables. Until then, we hope that the user renames his variable of interest to "data_sent".

If you are interested in using TreeScope, please contact hbhatia@llnl.gov.
