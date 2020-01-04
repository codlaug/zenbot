import sys
import ta
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import numpy as np
import tensorflow as tf

sess=tf.Session() 
signature_key = tf.saved_model.signature_constants.DEFAULT_SERVING_SIGNATURE_DEF_KEY
input_key = 'x_input'
output_key = 'y_output'

import_path =  './decider_python'
meta_graph_def = tf.saved_model.loader.load(sess, [tf.saved_model.tag_constants.SERVING], import_path)
signature = meta_graph_def.signature_def

x_tensor_name = signature[signature_key].inputs[input_key].name
y_tensor_name = signature[signature_key].outputs[output_key].name

x = sess.graph.get_tensor_by_name(x_tensor_name)
y = sess.graph.get_tensor_by_name(y_tensor_name)


# TODO: Be smarter about how I minmax scale


min_max_scaler = MinMaxScaler()


while True:

    args = input()
    arg_array = args.split(' ')

    timestamps = [ int(n) for n in arg_array[0].split(',') ]
    opens = [ float(n) for n in arg_array[1].split(',') ]
    high = [ float(n) for n in arg_array[2].split(',') ]
    low = [ float(n) for n in arg_array[3].split(',') ]
    close = [ float(n) for n in arg_array[4].split(',') ]
    volume = [ float(n) for n in arg_array[5].split(',') ]




    df = pd.DataFrame({'Timestamp': timestamps, 'Open': opens, 'High': high, 'Low': low, 'Close': close, 'Volume': volume}).set_index('Timestamp')


    ta.add_all_ta_features(df, open="Open", high="High", low="Low", close="Close", volume="Volume")


    columns = df.columns.values.tolist()
    columns.remove('momentum_kama') # was all nans


    signals = np.nan_to_num(df.loc[:, columns].to_numpy())

    signal_features = min_max_scaler.fit_transform(signals)

    pred = sess.run(y, {x: [signal_features[-1]]})
    print(pred) #output

    # for c,v in zip(columns, df.iloc[-1,:]):
    #     print(c, v)
    sys.stdout.flush()
# end while loop