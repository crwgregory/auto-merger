let github = require('octonode');

let repos = [
    'crwgregory/test-auto-merge'
];

function handler(event, context, callback) {
    mergeStaging()
}

function mergeStaging() {
    let client = github.client(process.env.GITHUB_TOKEN);
    repos.forEach(repo => {
        createPullRequest(client, repo, 'Auto Merge Staging', 'Time: ' + Date.now(), 'staging', 'master').then(pr => {
            if (!pr) { // if no pr is returned, like for when there are no commits between the branches
                console.log('Could not create pull request for repo: ' + repo);
                console.log('Possibly because there are no changes to merge');
                return;
            }
            getIsPRMergeable(client, repo, pr.number).then(isMergeable => {
                if (!isMergeable) {
                    throw new Error('PULL REQUEST IS NOT MERGEABLE! Repo: ' + repo + ' PR#: ' + pr.number)
                }
                merge(client, repo, pr.head.ref, 'master', 'build: automerge staging').then(sha => {
                    console.log('merge sha', sha)
                }).catch(e => {
                    throw e
                })
            }).catch(e => {
                throw e
            })
        }).catch(e => {
            throw e
        })
    })
}

/**
 *
 * @param client
 * @param repo
 * @param head
 * @param base
 * @returns {Promise<string>} return the commit hash of the merge result
 */
function merge(client, repo, head, base, commitMsg) {
    console.log('merge: ', repo, head, base, commitMsg);
    let ghrepo = client.repo(repo);
    return new Promise(((resolve, reject) => {
        ghrepo.merge({
            head: head,
            base: base,
            commit_message: commitMsg
        }, (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(data.sha)
        });
    }))
}

function getPullRequests(client, repo) {
    let ghrepo = client.repo(repo);
    return new Promise((resolve, reject) => {
        callbackToPromise(ghrepo, 'prs').then(data => resolve(data)).catch(e => reject(e))
    })
}

function getPullRequest(client, repo, prNumber) {
    let pr = client.pr(repo, prNumber);
    return new Promise((resolve, reject) => {
        callbackToPromise(pr, 'info').then(data => {
            resolve(data)
        }).catch(e => reject(e))
    })
}

/**
 * If the PR already exists, will go and try to find it and return it's number
 * @param client
 * @param repo
 * @param title
 * @param body
 * @param head
 * @param base
 * @returns {Promise<object>} returns the created pr
 */
function createPullRequest(client, repo, title, body, head, base) {
    console.log('createPullRequest: ', repo, title, body, head, base);
    let ghrepo = client.repo(repo);
    return new Promise((resolve, reject) => {
        ghrepo.pr({
            'title': title,
            'body': body,
            'head': head,
            'base': base
        }, (err, data) => {
            if (err) {
                if (!err.body || !err.body.errors) {
                    reject(err);
                    return
                }
                let fetch = err.body.errors.find(e => e.message && e.message.includes('A pull request already exists for'));
                if (fetch) {
                    getPullRequests(client, repo).then(prs => {
                        let pr = prs.find(p => p.head.label.includes(head));
                        if (!pr) {
                            reject(new Error('Could not find the PR Github Said Existed with head: ' + head))
                        } else {
                            console.log('pr already exists');
                            resolve(pr);
                        }
                    })
                } else {
                    let noDiff = err.body.errors.find(e => e.message && e.message.includes('No commits between master and'));
                    if (typeof noDiff !== 'undefined') {
                        // no error
                        resolve(null);
                    } else {
                        reject(octoNodeErrorToString(err))
                    }
                }
            } else {
                resolve(data) // return the pr
            }
        })
    });
}

function getIsPRMergeable(client, repo, prNumber) {
    return new Promise((resolve, reject) => {
        getPullRequest(client, repo, prNumber).then(data => {
            if (data.mergeable === null) {
                setTimeout(() => {
                    console.log('getIsPRMergeable: waiting 1 second');
                    getIsPRMergeable(client, repo, prNumber).then(d => resolve(d)).catch(e => reject(e))
                }, 1000)
            } else {
                resolve(data.mergeable)
            }
        }).catch(e => reject(e));
    })
}

function callbackToPromise(object, funcName, params = null) {
    return new Promise((resolve, reject) => {
        if (params) {
            object[funcName](params, (err, data, headers) => {
                if (err) {
                    reject(err)
                }
                resolve(data)
            })
        } else {
            object[funcName]((err, data, headers) => {
                if (err) {
                    reject(err)
                }
                resolve(data)
            })
        }
    })
}

function octoNodeErrorToString(err) {
    let es = '';
    if (err.hasOwnProperty('message')) {
        es += 'Message: ' + err.message + ' ';
    }
    if (err.hasOwnProperty('errors')) {
        err.errors.forEach((e, i) => {
            es += 'Error' + i + ': ' + JSON.stringify(e);
        })
    }
    if (err.hasOwnProperty('documentation_url')) {
        es += ' Doc URL: ' + err.documentation_url;
    }
    return es;
}

exports = Object.assign(exports, {
    'handler': handler,
    'getPullRequest': getPullRequest,
    'createPullRequest': createPullRequest,
    'mergeStaging': mergeStaging
});