/*
TreeScope, Version 1.0
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
*/


let channels = new Map();

/* -------------------------------------------------------------------------- */

export function subscribe(channel, listener) {
  if (!channels.has(channel)) channels.set(channel, new Set());
  channels.get(channel).add(listener);
  return this;
}

export function unsubscribe(topic, listener) {
  let channel = channels.get(topic);
  if (channel) {
    channel.delete(listener);
    if (channel.length == 0) channels.delete(topic);
  }
  return this;
}

export function publish(msg, ...data) {
  _publish(false, msg, data);
  return this;
}

export function publishSync(msg, ...data) {
  _publish(true, msg, data);
  return this;
}

function _publish(sync, msg, data) {
  let list = subscribers(msg);
  if (list.length == 0) return;
  let send = _envelope(list, msg, data);

  if (sync) send();
  else setTimeout(send, 0);
}

/* -------------------------------------------------------------------------- */

function subscribers(msg) {
  let topic = String(msg), list = [], channel, idx;
  while (true) {
    if (channels.has(topic)) list.push(topic);

    idx = topic.lastIndexOf('.');
    if (idx == -1) break;
    topic = topic.substring(0, idx);
  }
  return list;
}

function _envelope(subscribers, msg, data) {
  return () => {
    subscribers.forEach(topic => _broadcast(topic, msg, data));
  }
}

function _broadcast(topic, msg, data) {
  let channel = channels.get(topic) || {};
  for (let listener of channel) {
    listener(topic, ...data);
  }
}
/* -------------------------------------------------------------------------- */
