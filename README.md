# backend-tester
Test suite for backend-plus


![designing](https://img.shields.io/badge/stability-stable-red.svg)
[![npm-version](https://img.shields.io/npm/v/backend-tester.svg)](https://npmjs.org/package/backend-tester)
[![downloads](https://img.shields.io/npm/dm/backend-tester.svg)](https://npmjs.org/package/backend-tester)
[![build](https://github.com/codenautas/backend-tester/workflows/Node.js%20CI/badge.svg)](https://github.com/codenautas/backend-tester/actions?query=workflow%3A%22Node.js+CI%22)
[![outdated-deps](https://img.shields.io/github/issues-search/codenautas/backend-tester?color=9cf&label=outdated-deps&query=is%3Apr%20author%3Aapp%2Fdependabot%20is%3Aopen)](https://github.com/codenautas/backend-tester/pulls/app%2Fdependabot)


language: ![English](https://raw.githubusercontent.com/codenautas/multilang/master/img/lang-en.png)
also available in:
[![Spanish](https://raw.githubusercontent.com/codenautas/multilang/master/img/lang-es.png)](LEEME.md)

## Install

```sh
$ npm install backend-tester
```


## Main goal

Have a way to test systems based in backend-plus


![Work in progress](doc/work-in-progress.png)


## Usage

Assuming the app is in `./src/server`, the test will be in `./src/test`.


### test.ts
```ts
"use strict";

// import the backend-plus App beeing tested:
import { AppPrincipal } from '../server/app-principal';

// import the needed functions and clasess from the test suite:
import { startServer, Session } from "backend-tester";

// the way to describe expected types
import { is } from "guarantee-type";

describe("main tests", function(){
    var server: AppPrincipal;    // eslint-disable-line no-var
    before(async function(){
        this.timeout(4000);
        server = await startServer(new AppPrincipal());
        await session.login({
            username: 'user4test',
            password: 'Pass1234!long-enough',
        });
    });
    after(async function(){
        this.timeout(3000);
        await server.shootDownBackend()
    })

    const personDescription = is.object({
        person_id: is.number,
        name: is.string,
        age: is.number
    });

    it("inserts a new person and set the defaults", async function(){
        // ACT
        const row = await session.saveRecord('person', {name: 'Taylor Taylor', age:44}, personDescription);
        // ASSERT
        assert.ok(row.person_id > 0);
        assert.equal(row.name, 'TAYLOR TAYLOR');
    })
```


## License


[MIT](LICENSE)

