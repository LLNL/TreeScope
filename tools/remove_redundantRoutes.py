'''
TreeScope, Version 0.1
Author Harsh Bhatia
LLNL-CODE-743437

Copyright (c) 2017, Lawrence Livermore National Security, LLC.
Produced at the Lawrence Livermore National Laboratory.
Written by Harsh Bhatia, hbhatia@llnl.gov. LLNL-CODE-743437.

All rights reserved.

This file is part of TreeScope. For details, see https://github.com/LLNL/TreeScope.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
'''

# Remove redundant route files

from sys import argv,exit
import os, glob, subprocess
import argparse
import time, datetime


# compare two files. return true if they are the same
def compare2files(file1, file2):

    command = "diff " + file1 + " " + file2 + " | wc"
    wc = os.popen(command).read().split()
    print command, " => " , wc #, (wc[0] == '0' and wc[1] == '0' and wc[2] == '0')
    return (wc[0] == '0' and wc[1] == '0' and wc[2] == '0')

def deletefile(file):

    if not os.path.exists("./redundant"):
        os.makedirs("./redundant")

    command = "mv " + file + " ./redundant/" + file
    print command
    os.popen(command)

def remove_redundant(extn):

    # --------- sort files based on time stamp
    files = {}
    for filename in glob.glob(extn):
        ts = filename.split(".")[0]
        tstamp = time.mktime(datetime.datetime.strptime(ts, "%Y%m%d-%H%M%S").timetuple())

        files[tstamp] = filename

    pfile = ""
    cnt = 0

    for tstamp in sorted(files):

        cfile = files[tstamp]
        #print '\n', tstamp, cfile, pfile

        if pfile == '':
            pfile = cfile
            continue

        # if the new file does not provide any new information, delete it
        if True == compare2files(pfile, cfile):
            deletefile(cfile)
            cfile = pfile
            cnt = cnt+1

        pfile = cfile

    print 'Identified', cnt, extn, 'files as redundant!'

# ---------------------------------------------
if __name__ == '__main__':

    parser = argparse.ArgumentParser(description='Remove redundant *.rtable files in a directory')
    parser.add_argument('--indir', metavar='(indir)', required=True, nargs=1, help='Input directory')

    args = parser.parse_args()
    indir = args.indir[0]

    os.chdir(indir)

    remove_redundant("*rtable")
