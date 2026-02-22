import 'react-native-url-polyfill/auto';
import { Client, Account } from 'react-native-appwrite';

export const appwriteClient = new Client();

appwriteClient
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('renderflow')
    .setPlatform('com.renderflow.app');

export const appwriteAccount = new Account(appwriteClient);
