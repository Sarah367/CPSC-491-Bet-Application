import {auth} from "./firebase";

console.log("Connected to Firebase Project ID: ", auth.app.options.projectId);

export {auth}