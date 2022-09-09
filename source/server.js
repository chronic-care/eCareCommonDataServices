const http = require("http");
const smart = require("fhirclient");
const Session = require("./controllers/session");

// The settings that we use to connect to our SMART on FHIR server
const smartSettings = {
    clientId: "9ff4f5c4-f07c-464f-8d4b-90b90a76bebf",
    redirectUri: "http://localhost:4200",
    scope: "online_access patient/*.read openid profile offline_access patient/Observation.read launch fhirUser",
    iss: "https://gw.interop.community/SyntheaTest8/data"
};

// Just a simple function to reply back with some data (the current patient if
// we know who he is, or all patients otherwise
async function handler(client, res) {
    const data = await (client.patient.id
        ? client.patient.read()
        : client.request("Patient"));
    res.setHeader("Content-type", "application/json");
    res.end(JSON.stringify(data, null, 4));
}

// This is our storage factory function. It will be called with request and response and is
// expected to return a storage object that implements the basic storage interface found at
// https://github.com/smart-on-fhir/client-js/tree/master/src/storage/ServerStorage.ts
function getStorage({ request, response }) {
    const session = Session.fromRequest(request) || new Session();
    response.setHeader("Set-Cookie", session.cookie);
    return session;
}

// Our basic HTTP server
http.createServer((req, res) => {
    const url = new URL('https://gw.interop.community/SyntheaTest8/data');
    console.log('URL is = '+url.pathname);
    switch (url.pathname) {        
        // =============================================================================
        // LAUNCHING
        // =============================================================================
        // 1. If you remove the iss option and request https://q4mhq.sse.codesandbox.io/launch
        //    it will throw because the FHIR service url is not known!
        // 2. If an EHR calls it, it will append "launch" and "state" parameters. Try
        //    it by loading https://q4mhq.sse.codesandbox.io/launch?iss=https://launch.smarthealthit.org/v/r3/fhir&launch=eyJhIjoiMSIsImciOiIxIn0
        // 3. If you only add an "iss" url parameter (no "launch"), you are doing a
        //    "dynamic" standalone launch. The app cannot obtain a launch context but
        //    it is still useful to be able to do that. In addition, the SMART Sandbox
        //    can be used to build a standalone launch url that contains embedded launch
        //    context which may be perfect for previewing you app. For example load this
        //    to launch the app with Angela Montgomery from DSTU-2:
        //    https://q4mhq.sse.codesandbox.io/launch?iss=https://launch.smarthealthit.org/v/r2/sim/eyJrIjoiMSIsImIiOiJzbWFydC03Nzc3NzA1In0/fhir
        // 4. We have an "iss" authorize option to make this do standalone launch by
        //    default. In this case https://q4mhq.sse.codesandbox.io/launch will
        //    not throw. Note that the "iss" url parameter takes precedence over the iss
        //    option, so the app will still be launch-able from an EHR.
        // 5. If an open server is passed as an "iss" option, or as "iss" url parameter,
        //    no authorization attempt will be made and we will be redirected to the
        //    redirect_uri (in this case we don't have launch context and there is no
        //    selected patient so we show all patients instead). Try it:
        //    https://q4mhq.sse.codesandbox.io/launch?iss=https://r3.smarthealthit.org
        // 6. Finally, a "fhirServiceUrl" parameter can be passed as option or as url
        //    parameter. It is like "iss" but will bypass the authorization (only useful
        //    in testing and development). Example:
        //    https://q4mhq.sse.codesandbox.io/launch?fhirServiceUrl=https://launch.smarthealthit.org/v/r3/fhir
        case "/SyntheaTest8/data":
            smart(req, res, getStorage).authorize(smartSettings);
            break;

        // =============================================================================
        // APP
        // =============================================================================
        // The app lives at your redirect_uri (in this case that is
        // "https://c0che.sse.codesandbox.io/app"). After waiting for "ready()", you get
        // a client instance that can be used to query the fhir server.
        case "http://localhost:4200":
            smart(req, res, getStorage).ready().then(client => handler(client, res));
            break;

        // =============================================================================
        // SINGLE ROUTE
        // =============================================================================
        // In case you prefer to handle everything in one place, you can use the "init"
        // method instead of "authorize" and then "ready". It takes the same options as
        // "authorize"
        case "/":
            smart(req, res, getStorage)
                .init({ ...smartSettings, redirectUri: "/" })
                .then(client => handler(client, res));
            break;

        // 404 Error Handler
        default:
            res.writeHead(404);
            res.end("Cannot get " + url.pathname);
            break;
    }
}).listen(3000);