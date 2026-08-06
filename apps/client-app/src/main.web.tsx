import 'react-native-gesture-handler';
import 'leaflet/dist/leaflet.css';
import './styles/option-a.css';
import './styles/design-system.css';
import './styles/leaflet-overrides.css';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from '../app.json';

AppRegistry.registerComponent(appName, () => App);
AppRegistry.runApplication(appName, {
  rootTag: document.getElementById('root'),
});
