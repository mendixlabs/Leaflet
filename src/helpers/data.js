import Promise from 'dojo/promise/Promise';

export const getData = params => new Promise((resolve, reject) => {
    mx.data.get({
        params,
        callback: resolve,
        error: reject,
    });
});

export const fetchAttr = (obj, attr) => new Promise((resolve, reject) => {
    try {
        obj.fetch(attr, val => resolve(val));
    } catch (e) {
        reject(e);
    }
});
