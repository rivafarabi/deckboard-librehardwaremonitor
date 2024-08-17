const { Extension, log, INPUT_METHOD, PLATFORMS } = require('deckboard-kit');
const { Query } = require('node-wmi');

const SUFFIX = {
	load: '%',
	temperature: '°C',
};

class LibreHardwareMonitor extends Extension {
	hardwares = {};
	isSensorInputCompleted = false;

	constructor(props) {
		super(props);
		this.setValue = props.setValue;
		this.name = 'Libre Hardware Monitor';
		this.platforms = [PLATFORMS.WINDOWS];

		this.setInputOptions([], []);
		this.configs = [];
	}

	// Executes when the extensions loaded every time the app start.
	initExtension() {
		if (process.platform !== 'win32') {
			return;
		}

		this.fetchHardwareData();
	}

	update() {}

	/**
	 * @param {{value: string, label: string}[]} loadSensors
	 * @param {{value: string, label: string}[]} temperatureSensors
	 */
	setInputOptions(loadSensors, temperatureSensors) {
		this.inputs = [
			{
				label: 'Display Load Stats',
				value: 'lhw-load',
				icon: 'headphones',
				mode: 'graph',
				fontIcon: 'fas',
				color: '#8E44AD',
				input: [
					{
						label: 'Sensor',
						type: INPUT_METHOD.INPUT_SELECT,
						items: loadSensors,
					},
				],
			},
			{
				label: 'Display Temperature Stats',
				value: 'lhw-temperature',
				icon: 'headphones',
				mode: 'graph',
				fontIcon: 'fas',
				color: '#8E44AD',
				input: [
					{
						label: 'Sensor',
						type: INPUT_METHOD.INPUT_SELECT,
						items: temperatureSensors,
					},
				],
			},
		];
	}

	///Fetch all hardwares displayed on Libre Hardware Monitor
	fetchHardwareList() {
		Query()
			.namespace('root/LibreHardwareMonitor')
			.class('Hardware')
			.exec((err, data) => {
				if (err || !data) return;

				this.hardwares = {};

				for (let index = 0; index < data.length; index++) {
					const { HardwareType, Identifier, Name } = data[index];
					this.hardwares[Identifier] = {
						type: HardwareType,
						name: Name,
					};
				}
			});
	}

	///Fetch and send sensors data to app and connected device
	fetchHardwareData() {
		setInterval(async () => {
			if (Object.keys(this.hardwares).length === 0) {
				this.fetchHardwareList();
				return;
			}

			Query()
				.namespace('root/LibreHardwareMonitor')
				.class('Sensor')
				.where("SensorType='Load' OR SensorType='Temperature'")
				.exec((err, data) => {
					if (err || !data) return;

					if (!this.isSensorInputCompleted) {
						this.mapSensorToDeckboardInput(data);
					}

					let sensors = {};

					for (let index = 0; index < data.length; index++) {
						const { Identifier, Parent, Name, SensorType, Value } =
							data[index];
						const sensorType = SensorType.toLowerCase();

						if (!this.hardwares[Parent]) {
							continue;
						}

						const sensorId = `lhw-${Identifier}`;

						sensors[sensorId] = {
							value: Value.toFixed(1),
							title: Name,
							description: this.hardwares[Parent].name,
							suffix: SUFFIX[sensorType],
						};
					}

					this.setValue(sensors);
				});
		}, 5000);
	}

	/**
	 * @param {{
	 * 	Identifier: string,
	 * 	Value: number,
	 * 	Parent: string,
	 * 	Name: string,
	 * 	SensorType: string
	 * }[]} data
	 */
	mapSensorToDeckboardInput(data) {
		let loadSensors = [];
		let temperatureSensors = [];

		for (let index = 0; index < data.length; index++) {
			const hardware = this.hardwares[data[index].Parent];

			if (!hardware) continue;

			const sensorOption = {
				value: `lhw-${data[index].Identifier}`,
				label: `${hardware.name}: ${data[index].Name}`,
			};

			if (data[index].SensorType === 'Load') {
				loadSensors.push(sensorOption);
			} else if (data[index].SensorType === 'Temperature') {
				temperatureSensors.push(sensorOption);
			}
		}

		loadSensors.sort(this.sortOptionItemsByLabel);
		temperatureSensors.sort(this.sortOptionItemsByLabel);

		this.setInputOptions(loadSensors, temperatureSensors);
		this.isSensorInputCompleted = true;
	}

	sortOptionItemsByLabel(a, b) {
		const labelA = a.label.toUpperCase();
		const labelB = b.label.toUpperCase();
		if (labelA < labelB) {
			return -1;
		}
		if (labelA > labelB) {
			return 1;
		}

		return 0;
	}

	execute(action, args) {}
}

module.exports = (sendData) => new LibreHardwareMonitor(sendData);
