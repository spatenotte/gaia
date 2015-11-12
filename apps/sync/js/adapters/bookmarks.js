/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
  Bookmarks Data Adapter

    The purpose of the Bookmarks adapter is to retrieve bookmark records from
  Firefox Sync and merge them in a local bookmarks DataStore
  ('sync_bookmarks_store') which will be hosting Firefox Sync records only.
  This adapter implements the API defined by SyncEngine. For now the
  implementation allows only to retrieve bookmarks from Sync but it is not ready
  for pushing any changes. The high level algorithm implemented here is the
  following:
  - Traverse all the records coming from Firefox Sync and stored locally
    in Kinto.
  - Convert any new bookmark from the Firefox Sync format to the
    'sync_bookmarks_store' DataStore one.
  - For existing bookmarks merge the remote with the local bookmark after
    converting them to the proper 'sync_bookmarks_store' DS format.
  - Remove any existing bookmark that has been remotely deleted (these records
    come with a 'deleted: true' property).
**/

'use strict';

/* global
  asyncStorage,
  DataAdapters,
  LazyLoader
*/

const BOOKMARKS_COLLECTION_MTIME = '::collections::bookmarks::mtime';
const BOOKMARKS_LAST_REVISIONID = '::collections::bookmarks::revisionid';
const BOOKMARKS_SYNCTOID_PREFIX = '::synctoid::bookmarks::';

var BookmarksHelper = (() => {
  var _store;
  function _ensureStore() {
    if (_store) {
      return Promise.resolve(_store);
    }
    return navigator.getDataStores('bookmarks_store').then(stores => {
      _store = stores[0];
      return _store;
    });
  }

  /* SyncedCollectionMTime is the time of the last successful sync run.
   * Subsequent sync runs will not check any records from the Kinto collection
   * that have not been modified since then. This value is stored separately for
   * each user (userid uniquely defines the FxSync account we're syncing with).
   */
  function setSyncedCollectionMtime(mtime, userid) {
    return new Promise(resolve => {
      asyncStorage.setItem(userid + BOOKMARKS_COLLECTION_MTIME, mtime, resolve);
    });
  }

  function removeSyncedCollectionMtime(userid) {
    return new Promise(resolve =>
      asyncStorage.removeItem(userid + BOOKMARKS_COLLECTION_MTIME, resolve));
  }

  function getSyncedCollectionMtime(userid) {
    return new Promise(resolve => {
      asyncStorage.getItem(userid + BOOKMARKS_COLLECTION_MTIME, resolve);
    });
  }

  /* LastRevisionId is the revisionId the DataStore had at the beginning of the
   * last sync run. Even though there is only one DataStore, it is stored once
   * for each userid, because a sync run only syncs with the FxSync account of
   * the currently logged in user.
   */
  function getLastRevisionId(userid) {
    return new Promise(resolve => {
      asyncStorage.getItem(userid + BOOKMARKS_LAST_REVISIONID, resolve);
    });
  }

  function setLastRevisionId(revisionId, userid) {
    return new Promise(resolve => {
      asyncStorage.setItem(userid + BOOKMARKS_LAST_REVISIONID, revisionId,
          resolve);
    });
  }

  /*
   * setDataStoreId and getDataStoreId are used to create a table for caching
   * SynctoId to DataStoreId matching. When a `deleted: true` record comes from
   * FxSync, getDataStoreId can help to get DataStoreId easily. So a new record
   * comes, the adapter has to use setDataStoreId to store the ID matching.
   * Since both the synctoId and the dataStoreId for a given URL are unique to
   * the currently logged in user, we store these values prefixed per `userid`
   * (`xClientState` of the currently logged in user).
   */
  function setDataStoreId(synctoId, dataStoreId, userid) {
    return new Promise(resolve => {
      asyncStorage.setItem(userid + BOOKMARKS_SYNCTOID_PREFIX + synctoId,
                           dataStoreId,
                           resolve);
    });
  }

  function getDataStoreId(synctoId, userid) {
    return new Promise(resolve => {
      asyncStorage.getItem(userid + BOOKMARKS_SYNCTOID_PREFIX + synctoId,
                           resolve);
    });
  }

  function mergeRecordsToDataStore(localRecord, remoteRecord, fxsyncId) {
    if (!localRecord || !remoteRecord ||
        localRecord.id !== remoteRecord.id ||
        (remoteRecord.type === 'url' && localRecord.url !== remoteRecord.url)) {
      // Local and remote records have different url(id).
      console.error('Inconsistent records', localRecord, remoteRecord);
      throw new Error('Inconsistent records');
    }

    localRecord.name = remoteRecord.name;
    if (!localRecord.fxsyncRecords) {
      localRecord.fxsyncRecords = {};
    }
    localRecord.fxsyncRecords[fxsyncId] = remoteRecord.fxsyncRecords[fxsyncId];
    return localRecord;
  }

  function addBookmark(remoteRecord, userid) {
    // 1. Get bookmark by url(id of DataStore)
    // 2.A. If the bookmark already exists locally,
    //     we merge it with the remote one.
    // 2.B Add a new record with RevisionId.
    // 3. Add the DataStore record ID into LocalID <-> RemoteID matching table.

    var id = remoteRecord.id;
    var revisionId;
    return _ensureStore().then(store => {
      revisionId = store.revisionId;
      var fxsyncId = remoteRecord.fxsyncId;
      delete remoteRecord.fxsyncId;
      return store.get(id).then(localRecord => {
        if (localRecord) {
          var newBookmark = mergeRecordsToDataStore(localRecord, remoteRecord,
              fxsyncId);
          return store.put(newBookmark, id, revisionId);
        }
        return store.add(remoteRecord, id, revisionId);
      }).then(() => {
        return setDataStoreId(fxsyncId, id, userid);
      });
    }).catch(e => {
      console.error(e);
    });
  }

  function updateBookmarks(records, userid) {
    return new Promise(resolve => {
      records.reduce((reduced, current) => {
        return reduced.then(() => {
          if (current.deleted) {
            return deleteBookmark(current.id, userid);
          }
          return addBookmark(current, userid);
        });
      }, Promise.resolve()).then(resolve);
    });
  }

  function deleteBookmark(fxsyncId, userid) {
    var url;
    return getDataStoreId(fxsyncId, userid).then(id => {
      if (!id) {
        console.warn('Ignoring incoming tombstone for unknown FxSyncID',
            fxsyncId);
        return Promise.resolve();
      }
      url = id;
      return _ensureStore().then(store => {
        var revisionId = store.revisionId;
        return store.get(url).then(localRecord => {
          localRecord.fxsyncRecords[fxsyncId] = {
            deleted: true,
            id: fxsyncId
          };
          var isEmpty = Object.keys(localRecord.fxsyncRecords).every(value => {
            return localRecord.fxsyncRecords[value].deleted;
          });
          if (isEmpty && localRecord.syncNeeded) {
            return store.remove(url, revisionId);
          } else {
            return store.put(localRecord, url, revisionId);
          }
        });
      });
    });
  }

  function checkIfClearedSince(lastRevisionId, userid) {
    return _ensureStore().then(store => {
      if (lastRevisionId === null) {
        var cursor = store.sync();
        // Skip first task which is always { id: null, operation: 'clear' }
        cursor.next().then(() => {
          return cursor;
        });
      }
      return store.sync(lastRevisionId);
    }).then(cursor => {
      var wasCleared = false;
      return new Promise(resolve => {
        function runNextTask(cursor) {
          cursor.next().then(task => {
            if (task.operation === 'done') {
              resolve({
                newRevisionId: task.revisionId,
                wasCleared
              });
            } else {
              // In readonly mode, if the DataStore was cleared, or some records
              // were removed, it's possible that previously imported data was
              // lost. Therefore, we return wasCleared: true after playing the
              // DataStore history to its current revisionId, so that
              // removeSyncedCollectionMtime will be called, and a full
              // re-import is triggered.
              // If only one record was removed then it would not be necessary
              // to re-import the whole Kinto collection, but right now we have
              // no efficient way to retrieve just one record from the Kinto
              // collection based on URL, because we don't have a mapping from
              // URL to fxsyncId. Since readonly sync is idempotent, there is
              // not much harm in this, but it could possibly be made more
              // efficient, see
              // https://bugzilla.mozilla.org/show_bug.cgi?id=1223418.
              if (['clear', 'remove'].indexOf(task.operation) !== -1) {
                wasCleared = true;
              }
              // Avoid stack overflow:
              setTimeout(() => {
                // Will eventually get to a 'done' task:
                runNextTask(cursor);
              });
            }
          });
        }
        runNextTask(cursor);
      });
    });
  }

  /*
   * handleClear - trigger re-import if DataStore was cleared
   *
   * In the future, the bookmarks and history DataAdapters will support
   * two-way sync, so they will not only import data from the kinto.js
   * collection into the DataStore, but also check what changes have
   * been made recently in the DataStore, and reflect these in the kinto.js
   * collection. Until then, the only thing we check from the DataStore is
   * whether it has been cleared. If a `clear` operation was executed on the
   * DataStore since the last time we checked (`lastRevisionId`), then the
   * lastModifiedTime of the kinto.js collection is removed from asyncStorage,
   * triggering a full import.
   */
  function handleClear(userid) {
    var newRevisionId;
    return getLastRevisionId(userid).then(lastRevisionId => {
      return checkIfClearedSince(lastRevisionId, userid);
    }).then(result => {
      newRevisionId = result.newRevisionId;
      if(result.wasCleared) {
        // Removing this from asyncStorage will trigger a full re-import.
        return removeSyncedCollectionMtime(userid);
      }
      return Promise.resolve();
    }).then(() => {
      return setLastRevisionId(newRevisionId, userid);
    });
  }

  return {
    mergeRecordsToDataStore: mergeRecordsToDataStore,
    setSyncedCollectionMtime: setSyncedCollectionMtime,
    getSyncedCollectionMtime: getSyncedCollectionMtime,
    updateBookmarks: updateBookmarks,
    deleteBookmark: deleteBookmark,
    handleClear: handleClear
  };
})();

DataAdapters.bookmarks = {
/**
    KintoCollection.list() provides a list containing all the remotely retrieved
  Firefox Sync records sorted by "last_modified" property in descending order.
  After each sync request we save the "last_modified" property of the last
  processed record so we avoid going through the same records on following
  operations.

    Bookmark records are stored locally in a DataStore with format [1] while
  bookmark records coming from Firefox Sync (via Kinto collection) have
  format[2]. [4] is the detailed information for 6 different types defined in
  FxSync BC. We need to convert from [1] to [2] and viceversa. Also, we need to
  add the remote record ID[1.1] from the Kinto collection to its corresponding
  match in the local DataStore, so we can remove the local record afterwards
  when any deleting record requests with the format [3] are coming from FxSync.

  [1] Records stored in Bookmarks DataStore (BDS): {
    "id": "http://mozilla.org/", // KEY in PDS
    "url": "http://mozilla.org/",
    "name": "Mozilla",
    "type": "url",
    "iconable": false,
    "icon": "http://www.lego.com/favicon.ico",
    "fxsyncRecords": {
      'fxsyncID_A': fxsync_payload_A,
      'fxsyncID_B': fxsync_payload_B,
      'fxsyncID_C': fxsync_payload_C
    } // payload from BC
  }

  [2] Add/Update Records from Bookmark Collection (BC): {
    "id": "zMgfGkRinh92",
    "sortindex": 2000,
    "last_modified": 1442247272150,
    "payload": {
      "id": "zMgfGkRinh92",
      "type": "bookmark",
      "title": "Mozilla",
      "parentName": "mobile",
      "bmkUri": "http://mozilla.org/",
      "tags": [],
      "keyword": null,
      "description": null,
      "loadInSidebar": false,
      "parentid": "mobile"
    },
    "_status": "synced"
  }

  [3] Delete Records from Bookmark Collection (BC): {
    "id": "_Avscjx5srFy",
    "sortindex": 100,
    "last_modified": 1441985077970,
    "payload": {
      "id": "_Avscjx5srFy",
      "deleted": true
    },
    "_status": "synced"
  }

  [4] The schema table for 6 different types from [5]:
  +---------------+---------------+---------------+
  |   bookmark    | microsummary**|     query     |
  +---------------+---------------+---------------+
  |               | *generatorUri | *folderName   |
  |               | *staticTitle  | *queryId      |
  | title         | title         | title         |
  | bmkUri        | bmkUri        | bmkUri        |
  | description   | description   | description   |
  | loadInSidebar | loadInSidebar | loadInSidebar |
  | tags          | tags          | tags          |
  | keyword       | keyword       | keyword       |
  | parentid      | parentid      | parentid      |
  | parentName    | parentName    | parentName    |
  | predecessorid | predecessorid | predecessorid |
  | type          | type          | type          |
  +---------------+---------------+---------------+

  +---------------+---------------+---------------+
  | folder        | livemark      | separator     |
  +---------------+---------------+---------------+
  |               | *siteUri      | *pos          |
  |               | *feedUri      |               |
  | title         | title         |               |
  | parentid      | parentid      | parentid      |
  | parentName    | parentName    | parentName    |
  | predecessorid | predecessorid | predecessorid |
  | type          | type          | type          |
  +---------------+---------------+---------------+

  [*] Special property for its type.
  [**] microsummary is OBSOLETED. Please see here:
       https://wiki.mozilla.org/Microsummaries

  [5] https://docs.services.mozilla.com/sync/objectformats.html#bookmarks

**/
  _update(remoteRecords, lastModifiedTime, userid) {
    var bookmarks = [];
    for (var i = 0; i < remoteRecords.length; i++) {
      var payload = remoteRecords[i].payload;
      if (remoteRecords[i].last_modified <= lastModifiedTime) {
        break;
      }
      if (payload.type === 'microsummary') {
        console.warn('microsummary is OBSOLETED ', payload);
        continue;
      }
      if (!Number.isInteger(remoteRecords[i].last_modified)) {
        console.warn('Incorrect payload::last_modified? ', payload);
        continue;
      }
      if (payload.deleted) {
        bookmarks.push(payload);
        continue;
      } else if (['query', 'bookmark', 'folder', 'livemark', 'separator']
          .every(value => value !== payload.type)) {
        console.error('Unknown type? ', payload);
        continue;
      }
      var typeWithUri = ['query', 'bookmark']
          .some(value => value === payload.type);
      if (typeWithUri && !payload.bmkUri) {
        console.warn('Incorrect payload? ', payload);
        continue;
      }
      var fxsyncRecords = {};
      fxsyncRecords[payload.id] = remoteRecords[i].payload;
      fxsyncRecords[payload.id].timestamp = remoteRecords[i].last_modified;

      // FIXME: See https://bugzilla.mozilla.org/show_bug.cgi?id=1223420
      bookmarks.push({
        // URL is the ID for bookmark records in bookmarks_store, but there are
        // some types without a valid URL except bookmark type. URL is used as
        // its ID to compatible bookmarks_store for bookmark type record.
        // The combination of type and fxsyncID is used as its ID for the types
        // except bookmark.
        id: payload.type === 'bookmark' ? payload.bmkUri :
          (payload.type + '|' + payload.id),
        url: payload.bmkUri,
        name: payload.title,
        type: payload.type === 'bookmark' ? 'url' : 'others',
        iconable: false,
        icon: '',
        syncNeeded: true,
        fxsyncRecords: fxsyncRecords,
        fxsyncId: payload.id
      });
    }

    if (bookmarks.length === 0) {
      return Promise.resolve(false /* no writes done into kinto */);
    }

    return BookmarksHelper.updateBookmarks(bookmarks, userid).then(() => {
      var latestMtime = remoteRecords[0].last_modified;
      return BookmarksHelper.setSyncedCollectionMtime(latestMtime, userid);
    }).then(() => {
      // Always return false for a read-only operation.
      return Promise.resolve(false /* no writes done into kinto */);
    });
  },

  update(remoteBookmarks, options = { readonly: true }) {
    if (!options.readonly) {
      console.warn('Two-way sync not implemented yet for bookmarks.');
    }
    var mtime;
    return LazyLoader.load(['shared/js/async_storage.js'])
    .then(() => {
      // We iterate over the records in the Kinto collection until we find a
      // record whose last modified time is older than the time of the last
      // successful sync run. However, if the DataStore has been cleared, or
      // records have been removed from the DataStore since the last sync run,
      // we cannot be sure that all older records are still there. So in both
      // those cases we remove the SyncedCollectionMtime from AsyncStorage, so
      // that this sync run will iterate over all the records in the Kinto
      // collection, and not only over the ones that were recently modified.
      return BookmarksHelper.handleClear(options.userid);
    }).then(() => {
      return BookmarksHelper.getSyncedCollectionMtime(options.userid);
    }).then(_mtime => {
      mtime = _mtime;
      return remoteBookmarks.list();
    }).then(list => {
      return this._update(list.data, mtime, options.userid);
    }).catch(err => {
      console.error('Bookmarks DataAdapter update error', err);
      throw err;
    });
  },

  handleConflict(conflict) {
    // Because Bookmark adapter has not implemented record push yet,
    // handleConflict will always use remote records.
    return Promise.resolve(conflict.remote);
  }
};
